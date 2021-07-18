import acct from './account';

class Account {
	static async findAccount(ctx, id, token) {
		console.info('is this happening?');
		console.info(ctx.authGroup);
		console.info(id);
		const account = await acct.getAccount(ctx.authGroup._id, id);
		console.info(account);
		if (!account) {
			console.info('noooo');
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
	 * todo: The interface specifies findByFederated
	 * https://github.com/panva/node-oidc-provider/blob/d7a5ba5ba191d5af8e4bed9449cbb43a3d5a1619/example/support/account.js
	 */
}

export default Account;