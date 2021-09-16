import axios from 'axios';
import qs from 'qs';

const config = require('../../../config');

export default {
	// DEPRECATED - NOT NEEDED BECAUSE OF PKCE
	async getUIAccessTokens(group, iss, code, client, redirectUri) {
		const cl = JSON.parse(JSON.stringify(client));
		const data = {
		    'grant_type': 'authorization_code',
            'client_secret': cl.client_secret,
            'redirect_uri': redirectUri,
            'format': 'jwt',
            'code': code,
            'client_id': cl.client_id,
			'audience': `${config.UI_CORE_AUDIENCE_ORIGIN}/${group.prettyName}`
		};
		const options = {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			data: qs.stringify(data),
			url: `${iss}/token`,
		};
		return axios(options);
	}
};