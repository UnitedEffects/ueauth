import { v4 as uuid } from 'uuid';
import { nanoid } from 'nanoid';
const cryptoRandomString = require('crypto-random-string');
const config = require('../../config');
const { uniqueNamesGenerator, adjectives, colors, animals } = require('unique-names-generator');

const cMocks = {
	newClient(nm = undefined, groupId = undefined, scope = undefined) {
		const name = (nm) ? nm : uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals] });
		const aG = (groupId) ? groupId : nanoid();
		const cl = {
			'application_type': 'web',
			'grant_types': [
				'client_credentials',
				'authorization_code',
				'implicit'
			],
			'id_token_signed_response_alg': 'RS256',
			'require_auth_time': false,
			'response_types': [
				'code id_token',
				'code',
				'id_token'
			],
			'subject_type': 'public',
			'token_endpoint_auth_method': 'client_secret_basic',
			'introspection_endpoint_auth_method': 'client_secret_basic',
			'revocation_endpoint_auth_method': 'client_secret_basic',
			'require_signed_request_object': false,
			'request_uris': [],
			'client_id_issued_at': Date.now(),
			'client_id': uuid(),
			'client_name': name,
			'client_secret_expires_at': 0,
			'client_secret': cryptoRandomString({length: 86, type: 'url-safe'}),
			'redirect_uris': [`https://${config.UI_URL}`],
			'post_logout_redirect_uris': [`https://${config.UI_URL}`, `https://${config.SWAGGER}/oauth2-redirect.html`],
			'auth_group': aG
		};
		if (scope) cl.scope = scope;
		return cl;
	}
};

export default cMocks;