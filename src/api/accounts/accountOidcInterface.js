import acct from './account';

class Account {
	static async findAccount(ctx, id, token) {
		const account = await acct.getAccount(ctx.authGroup._id, id);
		if (!account) {
			return undefined;
		}
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

	/**
	 * @todo: The interface specifies findByFederated
	 * @body: https://github.com/panva/node-oidc-provider/blob/d7a5ba5ba191d5af8e4bed9449cbb43a3d5a1619/example/support/account.js
	 */
	static async findByFederated(provider, claims) {
		const id = `${provider}.${claims.sub}`;
		/*
		if (!logins.get(id)) {
			logins.set(id, new Account(id, claims));
		}*/
		console.info('here....');
		console.info(id);
		console.info(claims);
		return {
			accountId: id,
			async claims(use, scope) {
				return claims;
			},
		};
	}
}

export default Account;