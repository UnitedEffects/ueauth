import jsonPatch from 'jsonpatch';
import dal from './dal';
import helper from '../../helper';

export default {
    async writeAccount(data) {
        data.email = data.email.toLowerCase();
        if(!data.username) data.username = data.email;
        return dal.writeAccount(data);
    },

    async getAccounts(authGroup, q) {
        const query = await helper.parseOdataQuery(q);
        return dal.getAccounts(authGroup, query);
    },

    async getAccount(authGroup, id) {
        return dal.getAccount(authGroup, id);
    },

    async deleteAccount(authGroup, id) {
        return dal.deleteAccount(authGroup, id);
    },

    async patchAccount(authGroup, id, update) {
        const account = await dal.getAccount(authGroup, id);
        const patched = jsonPatch.apply_patch(JSON.parse(JSON.stringify(account)), update);
        return dal.patchAccount(authGroup, id, patched);
    },

    async getAccountByEmailOrUsername(g, em) {
        const email = String(em).toLowerCase();
        const authGroup = String(g).toLowerCase();
        return dal.getAccountByEmailOrUsername(authGroup, email);
    }
};