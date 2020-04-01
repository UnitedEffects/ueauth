import jsonPatch from 'jsonpatch';
import dal from './dal';
import helper from '../../helper';

export default {
    async writeAccount(data) {
        data.username = data.username.toLowerCase();
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

    async getAccountByUsername(un) {
        console.info('here too');
        console.info(un);
        console.info(typeof un);
        const username = String(un).toLowerCase();
        console.info(username);
        return dal.getAccountByUsername(username);
    }
};