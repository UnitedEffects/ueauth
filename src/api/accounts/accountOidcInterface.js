import acct from './account';

class Account {
    // This interface is required by oidc-provider
    static async findAccount(ctx, id, token) {
        // This would ideally be just a check whether the account is still in your storage
        console.info('findAccount '+id);
        console.info('findAccount Token '+token);
        console.info(ctx.req.params.authGroup);
        const account = await acct.getAccount(ctx.req.params.authGroup, id);
        if (!account) {
            return undefined;
        }

        return {
            accountId: id,
            // and this claims() method would actually query to retrieve the account claims
            async claims() {
                return {
                    sub: id,
                    group: account.authGroup,
                    email: account.email,
                    verified: account.verified,
                };
            },
        };
    }

    // This can be anything you need to authenticate a user
    static async authenticate(authGroup, email, password) {
        try {
            const account = await acct.getAccountByEmail(authGroup, email);
            if(account.verifyPassword(password)) {
                return account.id;
            }
            throw undefined
        } catch (err) {
            return undefined;
        }
    }
}

export default Account;