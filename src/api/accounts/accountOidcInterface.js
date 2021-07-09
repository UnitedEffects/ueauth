import acct from './account';

class Account {
	// This interface is required by oidc-provider
	static async findAccount(ctx, id, token) {
		console.info('called');
		const account = await acct.getAccount(ctx.authGroup._id, id);
		console.info(account.id);
		if (!account) {
			return undefined;
		}
		return {
			accountId: account.id,
			// and this claims() method would actually query to retrieve the account claims
			async claims(use, scope, claims, rejected) {
				return {
					sub: account.id,
					group: account.authGroup,
					username: account.username,
					email: account.email,
					verified: account.verified,
				};
			},
		};
	}

	// This can be anything you need to authenticate a user
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
}

export default Account;