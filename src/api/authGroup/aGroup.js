import jsonPatch from 'jsonpatch';
import dal from './dal';
import helper from '../../helper';

export default {
    async check(pName) {
        const docs = await dal.checkPrettyName(pName);
        return docs === 0;
    },

    async write(data) {
        return dal.write(data);
    },

    async get(q) {
        const query = await helper.parseOdataQuery(q);
        return dal.get(query);
    },

    async getOne(id) {
        return dal.getOne(id);
    },

    async getOneByEither(q) {
        return dal.getOneByEither(q);
    },

    async patch(id, update) {
        const group = await dal.getOne(id);
        const patched = jsonPatch.apply_patch(JSON.parse(JSON.stringify(group)), update);
        return dal.patch(id, patched);
    }
};