import { diff } from 'json-diff';
import jsonPatch from 'jsonpatch';
import dal from './dal';
import helper from '../../../helper';
import oidc from '../oidc';
import Adapter from '../dal';
import { v4 as uuid } from 'uuid';
import { snakeCase } from 'lodash';
import qs from "qs";
import axios from "axios";

const config = require('../../../config');
const Validator = require('jsonschema').Validator;
const cryptoRandomString = require('crypto-random-string');

const snakeKeys = (obj) => {
	if (Array.isArray(obj)) {
		return obj.map(v => snakeKeys(v));
	} else if (obj !== null && obj.constructor === Object) {
		return Object.keys(obj).reduce(
			(result, key) => ({
				...result,
				[snakeCase(key)]: snakeKeys(obj[key]),
			}),
			{},
		);
	}
	return obj;
};

export default {
	async generateClient(authGroup) {
		const options = {
			'client_secret': cryptoRandomString({length: 86, type: 'url-safe'}),
			'client_secret_expires_at': 0,
			'client_id_issued_at': Date.now(),
			'client_id': uuid(),
			'client_name': config.PLATFORM_NAME,
			'grant_types': ['client_credentials', 'authorization_code', 'implicit'],
			'response_types': ['code id_token', 'code', 'id_token'],
			'redirect_uris': [`https://${config.UI_URL}`],
			'post_logout_redirect_uris': [`https://${config.UI_URL}`, `https://${config.SWAGGER}/oauth2-redirect.html`],
			'auth_group': authGroup.id,
		};
		if(authGroup.primaryDomain) {
			if (authGroup.primaryDomain !== config.UI_URL) {
				let agDom = authGroup.primaryDomain;
				if(!authGroup.primaryDomain.includes('://')) {
					agDom = `https://${agDom}`;
				}
				options.post_logout_redirect_uris.push(agDom);
			}
		}
		const client = new (oidc(authGroup).Client)(options);
		const fixed = snakeKeys(JSON.parse(JSON.stringify(client)));
		const add = new Adapter('client');
		await add.upsert(client.clientId, fixed);
		return fixed;
	},

	async deleteNotificationsServiceClient(authGroup) {
		const check = await dal.getOneByName(authGroup, `${authGroup.id}_Global_Notification_Service`);
		if(check) return dal.deleteOne(authGroup, check._id);
		return null;
	},

	async generateNotificationServiceClient(authGroup) {
		const check = await dal.getOneByName(authGroup, `${authGroup.id}_Global_Notification_Service`);
		if(check) await dal.deleteOne(authGroup, check._id);
		const client = new (oidc(authGroup).Client)({
			'client_secret': cryptoRandomString({length: 86, type: 'url-safe'}),
			'client_secret_expires_at': 0,
			'client_id_issued_at': Date.now(),
			'client_id': uuid(),
			'client_name': `${authGroup.id}_Global_Notification_Service`,
			'grant_types': ['client_credentials'],
			'response_types': [],
			'redirect_uris': [`https://${config.UI_URL}`],
			'auth_group': authGroup.id,
			'scope': 'api:read api:write'
		});
		const fixed = snakeKeys(JSON.parse(JSON.stringify(client)));
		const add = new Adapter('client');
		await add.upsert(client.clientId, fixed);
		return fixed;
	},

	async generateClientCredentialToken(authGroup, client, scope, audience) {
		if(!authGroup) throw new Error('authGroupId not defined');
		const cl = JSON.parse(JSON.stringify(client));
		const iss = `${config.PROTOCOL}://${config.SWAGGER}/root`;
		const data = {
			'grant_type': 'client_credentials',
			'scope': scope,
			'resource': audience
		};
		const options = {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				'authorization': `basic ${Buffer.from(`${cl.payload.client_id}:${cl.payload.client_secret}`).toString('base64')}`
			},
			data: qs.stringify(data),
			url: `${iss}/token`,
		};

		return axios(options);
	},

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
		return jsonPatch.apply_patch(client.toObject(), update);
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