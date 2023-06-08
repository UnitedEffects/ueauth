import axios from 'axios';
import acc from '../../accounts/account';
import int from '../../oidc/interactions/interactions';
import request from '../../profiles/profiles/request';

export default {
	async processEvent(interaction, ag, accountId, uid, response) {
		try {
			if(interaction?.event) {
				switch(interaction.event.toUpperCase()) {
				case 'PASSWORD_RESET':
					if(response?.state === 'approved') {
						return acc.passwordResetNotify(ag, accountId);
					}
					throw response?.state;
				case 'MAGIC_LINK':
					if(response?.state === 'approved') {
						return int.sendMagicLink(ag, uid, ag?.aliasDnsOIDC || undefined, accountId, undefined);
					}
					throw response?.state;
				case 'UE.SECURED.PROFILE.ACCESS.REQUESTED':
					if(response?.state === 'approved') {
						return request.updateRequestStatus(ag, uid, 'approved', accountId);
					} else {
						return request.updateRequestStatus(ag, uid, 'denied', accountId);
					}
				case 'UE.CHALLENGE.CALLBACK':
					if(interaction.cb) return callback(interaction, response);
					break;
				default:
					// ignored
					throw `IGNORE UNKNOWN EVENT ${interaction.event}`;
				}
			}
		} catch (error) {
			console.error(error);
			return false;
		}
	}
};

async function callback(interaction, response) {
	const data = JSON.parse(JSON.stringify(interaction));
	data.state = data.uid;
	delete data.uid;
	const options = {
		url: interaction.cb,
		method: 'post',
		headers: {
			'Content-Type': 'application/json'
		},
		data: {
			challenge: data,
			response
		}
	};
	return axios(options);
}