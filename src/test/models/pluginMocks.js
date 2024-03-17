import { v4 as uuid } from 'uuid';
import { nanoid } from 'nanoid';
const cryptoRandomString = require('crypto-random-string');
const config = require('../../config');

const pmocks = {
	global: {
		'_id': uuid(),
		'notifications': {
			'enabled': false
		},
		'createdAt': '2021-08-23T15:51:18.634Z',
		'createdBy': 'test@unitedeffects.com',
		'version': 1,
		'__v': 0
	},
	notification(enabled = true) {
		const out = JSON.parse(JSON.stringify(pmocks.global));
		out.notifications.enabled = enabled;
		if(enabled === true) {
			out.notifications.notificationServiceUri = 'http://localhost:8080';
			out.notifications.registeredClientId = uuid();
		} else {
			delete out.notifications.notificationServiceUri;
			delete out.notifications.registeredClientId;
		}
		return out;
	},
	notificationClient() {
	    const group = nanoid();
        return {
            'application_type': 'web',
            'grant_types': [
                'client_credentials'
            ],
            'id_token_signed_response_alg': 'RS256',
            'require_auth_time': false,
            'response_types': [],
            'subject_type': 'public',
            'token_endpoint_auth_method': 'client_secret_basic',
            'introspection_endpoint_auth_method': 'client_secret_basic',
            'revocation_endpoint_auth_method': 'client_secret_basic',
            'require_signed_request_object': false,
            'request_uris': [],
            'client_id_issued_at': Date.now(),
            'client_id': uuid(),
            'client_name': `${group}_Global_Notification_Service`,
            'client_secret_expires_at': 0,
            'client_secret': cryptoRandomString({length: 86, type: 'url-safe'}),
            'redirect_uris': [`https://${config.UI_URL}`],
            'auth_group': group,
            'scope': 'api:read api:write'
        }
    }
};

export default pmocks;