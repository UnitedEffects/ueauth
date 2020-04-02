import Account from './model';

export default {
    async writeAccount(data) {
        const account =  new Account(data);
        return account.save();
    },
    async getAccounts(query) {
        return Account.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
    },
    async getAccount(id) {
        return Account.findOne( { _id: id });
    },
    async patchAccount(id, data) {
        data.modifiedAt = Date.now();
        return Account.findOneAndUpdate({ _id: id }, data, { new: true, overwrite: true })
    },
    async getAccountByEmail(email) {
        console.info('inside');
        return Account.findOne( { email });
    }
};