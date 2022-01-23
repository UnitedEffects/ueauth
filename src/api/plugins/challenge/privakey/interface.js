import axios from 'axios';
import qs from 'qs';
import Boom from '@hapi/boom';
import dal from '../dal';

const config = require('../../../../config');

const API = {
	challenge: 'https://cloud.privakey.com/api/request/add',
	validate: 'https://cloud.privakey.com/api/request/getRequest'
};

export default {
	returnAPI: API,
	async sendChallenge(authGroup, account, uid) {
		const callback = `${config.PROTOCOL}://${(authGroup.aliasDnsOIDC) ? authGroup.aliasDnsOIDC : config.SWAGGER}/api/${authGroup.id}/mfa/callback`;
		const options = {
			url: API.challenge,
			method: 'post',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			auth: {
				username: authGroup.config.mfaChallenge.meta.privakeyClient,
				password: authGroup.config.mfaChallenge.meta.privakeySecret
			},
			data: qs.stringify({
				accountId: account.accountId,
				duration: '5m',
				additionalInfo: {"template":"true"},
				transactionId: JSON.stringify({ uid, accountId: account.accountId }),
				callback,
				showCode: true,
				showNotification: true,
				content: {
					title: 'Authorization Request',
					keys: [{
						key: `${authGroup.name} Platform`,
						value: 'If you initiated this login, approve below. Otherwise click Decline and change your password.'
					}]
				},
				buttons: [
					{
						title: 'Approve',
						strongAuth: true,
						style: "{\"color\":\"green\"}"
					},
					{
						title: 'Decline',
						strongAuth: false,
						style: "{\"color\":\"#FF0000\"}"
					}
				],
			})
		};
		const pkey = await axios(options);
		if(!pkey?.data?.transactionId) throw Boom.failedDependency('Privakey issue...');
		const returnId = JSON.parse(pkey.data.transactionId);
		if(returnId.uid !== uid) {
			throw Boom.failedDependency('Mismatch of Interaction ID and MFA transaction');
		}
		if(returnId.accountId !== account.accountId) {
			throw Boom.failedDependency('Mismatch of Account ID and MFA transaction');
		}
		try {
			await dal.saveChallenge({
				authGroup: authGroup.id,
				providerKey: pkey.data.guid,
				uid,
				accountId: account.accountId,
				state: 'pending'
			});
		} catch (error) {
			if(error.code !== 11000) throw error;
			//skipping dups
		}
		return {
			id: pkey.data.guid,
			provider: 'privakey',
			response: pkey.data
		};
	},
	async validateRequest(id, authGroup) {
		const options = {
			url: API.validate,
			method: 'get',
			headers: {
				'Content-Type': 'application/json'
			},
			auth: {
				username: authGroup.config.mfaChallenge.meta.privakeyClient,
				password: authGroup.config.mfaChallenge.meta.privakeySecret
			},
			query: {requestGuid: id}
		};
		return axios(options);
	}
};