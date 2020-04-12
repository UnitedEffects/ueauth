import dal from './dal';
import helper from '../../../helper';

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

    async validateUniqueNameGroup(authGroup, clientName) {
        const results = await dal.getCount(authGroup, { query: { 'payload.client_name': clientName } });
        return results === 0;
    }
};