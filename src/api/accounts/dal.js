import Account from './model';

export default {
    async writeAccount(data) {
        const account =  new Account(data);
        return account.save();
    },
    async getAccounts(g, query) {
        if (g.toLowerCase() !== 'all') query.query.authGroup = g;
        return Account.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
    },
    async getAccount(authGroup, id) {
        return Account.findOne( { _id: id, authGroup });
    },
    async patchAccount(authGroup, id, data) {
        data.modifiedAt = Date.now();
        return Account.findOneAndUpdate({ _id: id, authGroup }, data, { new: true, overwrite: true })
    },
    async getAccountByEmail(authGroup, email) {
        return Account.findOne( { authGroup, email });
    }
};