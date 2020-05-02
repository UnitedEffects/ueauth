import dal from './dal';
import helper from '../../../helper';

const cryptoRandomString = require('crypto-random-string');

export default {
    async get(authGroup, q) {
        const query = await helper.parseOdataQuery(q);
        return dal.get(authGroup, query);
    },

    async getOne(authGroup, id) {
        const result = await dal.getOne(authGroup, id);
        if (result && result.payload) {
            return result.payload;
        }
        return undefined;
    },

    async deleteOne(authGroup, id) {
        const result = await dal.deleteOne(authGroup, id);
        if (result && result.payload) {
            return result.payload;
        }
        return undefined;
    },

    async validateUniqueNameGroup(authGroup, clientName, id) {
        const results = await dal.getCount(authGroup, id, { query: { 'payload.client_name': clientName } });
        return results === 0;
    },

    async rotateSecret(id, auth_group) {
        const client_secret = cryptoRandomString({length: 86, type: 'url-safe'});
        const result = dal.rotateSecret( { _id: id, 'payload.auth_group': auth_group }, { 'payload.client_secret': client_secret });
        if (result && result.payload) {
            return result.payload;
        }
        return undefined;
    }
};