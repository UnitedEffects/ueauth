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

    async deleteOne(id) {
        return dal.deleteOne(id);
    },

    async getOneByEither(q, onlyIncludeActive=true) {
        return dal.getOneByEither(q, onlyIncludeActive);
    },

    async patch(id, update) {
        const group = await dal.getOne(id);
        const patched = jsonPatch.apply_patch(JSON.parse(JSON.stringify(group)), update);
        return dal.patch(id, patched);
    },

    async activateNewAuthGroup(authGroup, account, clientId) {
        const copy = JSON.parse(JSON.stringify(authGroup));
        copy.owner = account._id;
        copy.modifiedBy = account._id;
        copy.active = true;
        copy.__v = authGroup.__v;
        copy.associatedClient = clientId;
        delete copy.securityExpiration;
        return dal.activatePatch(authGroup._id, copy);
    }
};