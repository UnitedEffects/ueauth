import acct from './account';
//import group from '../authGroup/group';

class Account {
	// This interface is required by oidc-provider
	static async findAccount(ctx, id, token) {
		// This would ideally be just a check whether the account is still in your storage
		const account = await acct.getAccount(ctx.authGroup._id, id);
		if (!account) {
			return undefined;
		}

		return {
			accountId: id,
			// and this claims() method would actually query to retrieve the account claims
			async claims(use, scope, claims, rejected) {
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

	// This can be anything you need to authenticate a user
	static async authenticate(authGroupId, email, password) {
		try {
			const account = await acct.getAccountByEmailOrUsername(authGroupId, email);
			if(account.verifyPassword(password)) {
				return account.id;
			}
			throw undefined;
		} catch (err) {
			return undefined;
		}
	}
}

export default Account;