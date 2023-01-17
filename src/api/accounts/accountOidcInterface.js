import acct from './account';
import Boom from '@hapi/boom';
import orgs from '../orgs/orgs';

const cryptoRandomString = require('crypto-random-string');

function createAccessObject(organization) {
	const orgAccess = {
		organization: {
			id: organization.id
		}
	};
	if (organization.access?.required === true) {
		orgAccess.organization.terms = {
			required: true,
			accepted: false,
			termsDeliveredOn: Date.now(),
			termsOfAccess: organization.access.terms,
			termsVersion: organization.access.termsVersion
		};
	}
	return orgAccess;
}

function accountWithClaims(id, account) {
	return {
		accountId: id,
		async claims(use, scope) {
			return {
				sub: id,
				group: account.authGroup,
				username: account.username,
				email: account.email,
				verified: account.verified,
				profile: `POST /api/${account.authGroup}/profile/request/${id}`
			};
		},
	};
}

function cleanProfile(profile) {
	if(profile.group) {
		// in case you are federating to another UE AUTH
		profile.federated_group = profile.group;
		delete profile.group;
	}
	if(profile.iss) delete profile.iss;
	if(profile.azp) delete profile.azp;
	if(profile.aud) delete profile.aud;
	if(profile.nonce) delete profile.nonce;
	if(profile.iat) delete profile.iat;
	if(profile.exp) delete profile.exp;
	if(profile.jti) delete profile.jti;
	if(profile.nonce_supported) delete profile.nonce_supported;
	if(profile.c_hash) delete profile.c_hash;
	if(profile.auth_time) delete profile.auth_time;
	return profile;
}

class Account {
	static async findAccount(ctx, id, token) {
		let account = await acct.getAccount(ctx.authGroup._id, id);
		if (!account) {
			throw Boom.unauthorized('Account not found');
		}
		return accountWithClaims(id, account);
	}

	// This can be anything you need to authenticate a user - in OP docs this is called findByLogin
	static async authenticate(authGroup, email, password) {
		try {
			const account = await acct.getAccountByEmailOrUsername(authGroup.id, email);
			if(account.active !== true || account.blocked === true || account.userLocked === true) throw undefined;
			if(authGroup && authGroup.config && authGroup.config.requireVerified === true) {
				if (account.verified === false) {
					throw undefined;
				}
			}

			if(await account.verifyPassword(password)) {
				return { accountId: account.id, mfaEnabled: account.mfa.enabled };
			}

			throw undefined;
		} catch (err) {
			return undefined;
		}
	}

	static async findByFederated(authGroup, provider, claims, orgSSO = undefined) {
		if(!claims.email) throw new Error('Email is a required scope for federation');
		if(claims.id && !claims.sub) {
			claims.sub = claims.id;
		}
		let account = await acct.getAccountAccessByEmailOrUsername(authGroup.id, claims.email);
		const profile = cleanProfile(JSON.parse(JSON.stringify(claims)));
		if(!account && authGroup.locked === true) {
			throw Boom.forbidden('The Federated Account does not exist and can not be added because the Auth Group is locked');
		}

		// was there an org id specified via orgSSO?
		let organization;
		if(orgSSO) {
			try {
				organization = JSON.parse(JSON.stringify(await orgs.getOrg(authGroup.id, orgSSO)));
			} catch (e) {
				console.error(e);
				throw Boom.badRequest(`An org was specified for this federated login but could not be resolved: ${orgSSO}`);
			}

			// if the organization intends to add the federated account, ensure there is not an email domain issue
			if(organization && organization.ssoAddAccountToOrg === true && organization.restrictEmailDomains === true) {
				const domainCheck = profile?.email?.toLowerCase().split('@')[1];
				if(!organization.emailDomains.includes(domainCheck)) {
					throw Boom.forbidden('Email domain is not whitelisted for the organization');
				}
			}
		}

		if(!account) {
			// write a new account with an identity...
			const accData = {
				authGroup: authGroup.id,
				email: profile.email,
				username: profile.username || profile.email,
				password: cryptoRandomString({length: 32, type: 'url-safe'}),
				createdBy: provider,
				modifiedBy: provider,
				verified: true,
				identities: [{
					id: claims.sub,
					provider,
					profile
				}]
			};

			// if we are here and an org is specified witha addAccount true, write the data
			if(organization && organization.ssoAddAccountToOrg) {
				accData.access = [];
				const orgAccess = createAccessObject(organization);
				accData.access.push(orgAccess);

			}

			account = await acct.writeAccount(accData);
		} else {
			let ident = [];
			ident = account.identities.filter((identity) => {
				return (identity.id === claims.sub && identity.provider === provider);
			});
			if (ident.length === 0) {
				account.identities.push({
					id: claims.sub,
					provider,
					profile
				});
			} else if (!ident[0].profile || Object.keys(ident[0].profile).length !== Object.keys(profile).length) {
				account.identities.map((identity) => {
					if(identity.id === claims.sub) {
						identity.profile = profile;
					}
				});
			}

			// if we are here and an organization has been specified with addAccount true, we can do so
			if(organization?.ssoAddAccountToOrg) {
				const orgAccess = createAccessObject(organization);
				if(!account.access) account.access = [];
				const access = account.access.filter((a) => {
					return (a.organization.id === organization.id);
				});
				if(!access.length) {
					account.access.push(orgAccess);
				}
			}
			await account.save();
		}
		return accountWithClaims(account.id, account);
	}
}

export default Account;