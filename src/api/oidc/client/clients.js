import { diff } from 'json-diff';
import jsonPatch from 'jsonpatch';
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

    async getOneFull(authGroup, id) {
        return dal.getOne(authGroup, id);
    },

    async preparePatch(client, update) {
        return jsonPatch.apply_patch(JSON.parse(JSON.stringify(client)), update);
    },

    async checkAllowed(client, patched) {
        const pay1 = JSON.parse(JSON.stringify(client.payload));
        const pay2 = JSON.parse(JSON.stringify(patched.payload));
        const jDiff = diff(pay1, pay2);
        return validateDiff(jDiff);
    },

    async patchOne(authGroup, id, patched) {
        const result = await dal.patchOne(authGroup, id, patched);
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

    async rotateSecret(id, authGroup) {
        const client_secret = cryptoRandomString({length: 86, type: 'url-safe'});
        const result = dal.rotateSecret( { _id: id, $or: [{ 'payload.auth_group': authGroup._id }, { 'payload.auth_group': authGroup.prettyName }] }, { 'payload.client_secret': client_secret });
        if (result && result.payload) {
            return result.payload;
        }
        return undefined;
    }
};

async function validateDiff(diff) {
    if(!diff) return true;
    let allowed = true;
    const props = [
        'client_name',
        'grant_types',
        'redirect_uris',
        'request_uris',
        'subject_type',
        'application_type',
        'require_auth_time',
        'token_endpoint_auth_method',
        'introspection_endpoint_auth_method',
        'revocation_endpoint_auth_method'
    ];
    await Promise.all(Object.keys(diff).map((key) => {
        console.info(key);
        if (!props.includes(key)) allowed = false;
    }));
    console.info('done');
    return allowed;
}