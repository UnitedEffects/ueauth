import acct from './account';

class Account {
    // This interface is required by oidc-provider
    static async findAccount(ctx, id) {
        // This would ideally be just a check whether the account is still in your storage
        const account = await acct.getAccount(id);
        if (!account) {
            return undefined;
        }

        return {
            accountId: id,
            // and this claims() method would actually query to retrieve the account claims
            async claims() {
                return {
                    sub: id,
                    email: account.email,
                    verified: account.verified,
                };
            },
        };
    }

    // This can be anything you need to authenticate a user
    static async authenticate(username, password) {
        console.info('here');
        try {
            const account = await acct.getAccountByUsername(username);
            console.info(account);
            if(account.verifyPassword(password)) return account.id;
            throw undefined
        } catch (err) {
            return undefined;
        }
    }
}

export default Account;