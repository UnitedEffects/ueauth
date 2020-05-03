import { diff } from 'json-diff';
import jsonPatch from 'jsonpatch';
import dal from './dal';
import helper from '../../../helper';

const Validator = require('jsonschema').Validator;

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
        return dal.getOneFull(authGroup, id);
    },

    async preparePatch(client, update) {
        return jsonPatch.apply_patch(JSON.parse(JSON.stringify(client)), update);
    },

    async checkSchema(client) {
        const v = new Validator();
        const swag = require('../../../swagger');
        const schema = swag.default.components.schemas.clientObject;
        const result = v.validate(client.payload, schema);
        return result.errors;
    },

    async checkAllowed(client, patched) {
        const pay1 = JSON.parse(JSON.stringify(client.payload));
        const pay2 = JSON.parse(JSON.stringify(patched.payload));
        const jDiff = diff(pay1, pay2);
        return validateDiff(jDiff);
    },

    async validateOIDC(client) {
        if (client.response_types.includes('code') && !client.grant_types.includes('authorization_code')) return 'CODE';
        if (client.response_types.includes('id_token') && !client.grant_types.includes('implicit')) return 'ID_TOKEN';
        if (client.response_types.includes('token') && !client.grant_types.includes('implicit')) return 'TOKEN';
        return null;
    },

    async patchOne(authGroup, id, patched) {
        const result = await dal.patchOne(authGroup, id, patched);
        if (result && result.payload) {
            return JSON.parse(JSON.stringify(result.payload));
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
        const results = await dal.getCount(authGroup, id, clientName);
        return results === 0;
    },

    async rotateSecret(id, authGroup) {
        const client_secret = cryptoRandomString({length: 86, type: 'url-safe'});
        const result = await dal.rotateSecret(id, authGroup, client_secret);
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
        'response_types',
        'request_uris',
        'subject_type',
        'application_type',
        'require_auth_time',
        'token_endpoint_auth_method',
        'introspection_endpoint_auth_method',
        'revocation_endpoint_auth_method'
    ];
    await Promise.all(Object.keys(diff).map((key) => {
        if (!props.includes(key)) allowed = false;
    }));
    return allowed;
}