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
		let account = await acct.getAccountByEmailOrUsername(authGroup.id, claims.email);
		const profile = JSON.parse(JSON.stringify(claims));
		if(profile.group) {
			// in case you are federating to another UE AUTH
			profile.federated_group = profile.group;
			delete profile.group;
		}
		if(!account && authGroup.locked === true) {
			throw Boom.forbidden('The Federated Account does not exist and can not be added because the Auth Group is locked');
		}
		if(!account) {
			// write a new account with an identity...
			account = await acct.writeAccount({
				authGroup: authGroup.id,
				email: claims.email,
				username: claims.username || claims.email,
				password: cryptoRandomString({length: 32, type: 'url-safe'}),
				createdBy: provider,
				modifiedBy: provider,
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