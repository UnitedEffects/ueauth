import acct from './account';
import Boom from '@hapi/boom';

const cryptoRandomString = require('crypto-random-string');

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
			if(authGroup && authGroup.config && authGroup.config.requireVerified === true) {
				if (account.verified === false) {
					throw undefined;
				}
			}

			if(await account.verifyPassword(password)) {
				return account.id;
			}
			throw undefined;
		} catch (err) {
			return undefined;
		}
	}

	static async findByFederated(authGroup, provider, claims) {
		if(!claims.email) throw new Error('Email is a required scope for federation');
		if(claims.id && !claims.sub) {
			claims.sub = claims.id;
		}
		let account = await acct.getAccountByEmailOrUsername(authGroup.id, claims.email);
		const profile = cleanProfile(JSON.parse(JSON.stringify(claims)));
		if(!account && authGroup.locked === true) {
			throw Boom.forbidden('The Federated Account does not exist and can not be added because the Auth Group is locked');
		}

		if(!account) {
			// write a new account with an identity...
			account = await acct.writeAccount({
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
			});
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
				await account.save();
			} else if (!ident[0].profile || Object.keys(ident[0].profile).length !== Object.keys(profile).length) {
				account.identities.map((identity) => {
					if(identity.id === claims.sub) {
						identity.profile = profile;
					}
				});
				await account.save();
			}
		}
		return accountWithClaims(account.id, account);
	}
}

export default Account;