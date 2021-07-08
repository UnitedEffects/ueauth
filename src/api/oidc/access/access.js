import axios from 'axios';
import qs from 'qs';

export default {
	async getUIAccessTokens(group, iss, code, client, redirect_uri) {
		const cl = JSON.parse(JSON.stringify(client));
		const data = {
		    'grant_type': 'authorization_code',
            'client_secret': cl.client_secret,
            'redirect_uri': redirect_uri,
            'format': 'jwt',
            'code': code,
            'client_id': cl.client_id
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