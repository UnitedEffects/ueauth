import axios from 'axios';
import qs from 'qs';
import Boom from '@hapi/boom';
import dal from '../dal';

const config = require('../../../../config');

const API = {
	domain: 'https://cloud.privakey.com',
	challenge: '/api/request/add',
	validate: '/api/request/getRequest'
};

const privakeyApi = {
	returnAPI: API,
	async findChallengeAndUpdate(provider, ag, data) {
		//ignoring provider parameter for this implementation
		if(!data.transactionId) throw Boom.badRequest('No transactionId');
		if(!data.guid) throw Boom.badRequest('No privakeyId');
		if(!Object.keys(data).includes('buttonSelected')) throw Boom.badRequest('No action indicated');
		const state = (data.buttonSelected === 0) ? 'approved' : 'denied';
		let interaction;
		try {
			interaction = JSON.parse(data.transactionId);
		} catch (error) {
			throw Boom.badRequest('TransactionId format not JSON');
		}
		if(!interaction.uid) throw Boom.badRequest('No interaction id found');
		if(!interaction.accountId) throw Boom.badRequest('No account id found');
		const uid = interaction.uid;
		const accountId = interaction.accountId;
		// using the validateRequest provider parameter to keep the interface consistent
		const validate = await privakeyApi.validateRequest({
			privakeyClient: ag.config.mfaChallenge.meta.privakeyClient,
			privakeySecret: ag.config.mfaChallenge.meta.privakeySecret
		}, data.guid);
		if(validate?.data?.guid !== data.guid ||
			validate?.data?.transactionId !== data.transactionId ||
			validate?.data?.buttonSelected !== data.buttonSelected) {
			throw Boom.badRequest('Invalid Callback Detected');
		}
		const update = {
			uid,
			accountId,
			providerKey: data.guid,
			authGroup: ag.id,
			state
		};
		return dal.findChallengeAndUpdate(update);
	},
	async sendChallenge(provider, authGroup, account, uid) {
		//ignoring provider parameter for this implementation
		const callback = `${config.PROTOCOL}://${(authGroup.aliasDnsOIDC) ? authGroup.aliasDnsOIDC : config.SWAGGER}/api/${authGroup.id}/mfa/callback`;
		const options = {
			url: `${API.domain}${API.challenge}`,
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
	async validateRequest(provider, id) {
		// provider is unique for this plugin interface...
		const options = {
			url: `${API.domain}${API.validate}`,
			method: 'get',
			headers: {
				'Content-Type': 'application/json'
			},
			auth: {
				username: provider.privakeyClient,
				password: provider.privakeySecret
			},
			params: {requestGuid: id}
		};
		return axios(options);
	}
};

export default privakeyApi;