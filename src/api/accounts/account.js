import jsonPatch from 'jsonpatch';
import dal from './dal';
import helper from '../../helper';

export default {
    async writeAccount(data) {
        data.email = data.email.toLowerCase();
        return dal.writeAccount(data);
    },

    async getAccounts(q) {
        const query = await helper.parseOdataQuery(q);
        return dal.getAccounts(query);
    },

    async getAccount(id) {
        return dal.getAccount(id);
    },

    async patchAccount(id, update) {
        const account = await dal.getAccount(id);
        const patched = jsonPatch.apply_patch(JSON.parse(JSON.stringify(account)), update);
        return dal.patchAccount(id, patched);
    },

    async getAccountByEmail(em) {
        console.info('here too');
        console.info(em);
        console.info(typeof em);
        const email = String(em).toLowerCase();
        console.info(email);
        return dal.getAccountByEmail(email);
    }
};