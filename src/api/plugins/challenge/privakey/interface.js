import axios from 'axios';
import qs from 'qs';
import Boom from '@hapi/boom';
import dal from '../dal';
import pInit from './initApi';
import events from '../eventProcessor';

const config = require('../../../../config');

const API = {
	domain: 'https://cloud.privakey.com',
	challenge: '/api/request/add',
	validate: '/api/request/getRequest',
	bind: '/api/account/bind',
	devices: '/api/device/getAll',
	revoke: '/api/device/revoke',
	bindWebAuthN: '/api/account/webauthn/bind',
	finishWebAuthN: '/api/account/webauthn/register',
	authWebAuthN: '/api/request/webauthn/authenticate',
	authWebAuthNFinish: '/api/request/webauthn/finishAuthentication'
};

const APP_LINKS = {
	android: 'https://play.google.com/store/apps/details?id=com.privakey.authwallet',
	ios: 'https://apps.apple.com/us/app/authwallet/id1552057206'
};

const pkApi = {
	returnAPI: API,
	async bindInstructions(provider, bindData) {
		const instructions = [
			`Download the AuthWallet app, available on <a target='_blank' href='${APP_LINKS.android}'>Google Play</a> and the <a target='_blank' href="${APP_LINKS.ios}">App Store.</a>`,
			'Open the app on your device and select to Add Service.',
			'Scan the QR code below using the app to bind your device to your user account.',
			'Once you are sure you have successfully added the service, click the button below or follow the equivalent instruction.'
		];
		return {
			instructions,
			qrCode: `authwallet://st=${
				bindData.sessionToken
			}&appSpaceGuid=${
				bindData.appSpaceGuid
			}&appSpaceName=${
				bindData.appSpaceName
			}`
		};
	},
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
		const validate = await pkApi.validateRequest({
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
		const result = await dal.findChallengeAndUpdate(update);
		// if there is an event in the message, we process
		await events.processEvent(interaction?.event, ag, accountId, uid, result);
		return result;
	},
	async bindUser(provider, authGroup, account) {
		//ignoring provider parameter for this implementation
		const options = {
			url: `${API.domain}${API.bind}`,
			method: 'put',
			headers: {
				'Content-Type': 'application/json'
			},
			auth: {
				username: authGroup.config.mfaChallenge.meta.privakeyClient,
				password: authGroup.config.mfaChallenge.meta.privakeySecret
			},
			data: {
				accountId: account.accountId
			}
		};
		const pkey = await axios(options);
		if(!pkey?.data?.sessionToken || !pkey?.data?.appSpaceGuid || !pkey?.data?.appSpaceName) {
			console.error(pkey);
			throw Boom.failedDependency('Bind request unsuccessful');
		}
		return pkey.data;
	},
	async reqWebAuthN(provider, authGroup, data) {
		//ignoring provider parameter for this implementation
		const options = {
			url: `${API.domain}${API.authWebAuthN}`,
			method: 'post',
			headers: {
				'Content-Type': 'application/json'
			},
			auth: {
				username: authGroup.pluginOptions.webAuthN.meta.privakeyClient,
				password: authGroup.pluginOptions.webAuthN.meta.privakeySecret
			},
			data: {
				accountId: data.accountId,
				domain: data.domain
			}
		};
		const pkey = await axios(options);
		if(!pkey?.data?.requestGuid) {
			throw Boom.failedDependency('auth request unsuccessful');
		}
		const output = JSON.parse(JSON.stringify(pkey.data));
		output.success = true;
		output.accountId = data.accountId;
		return output;
	},
	async finishWebAuthNReq(event, accountId, credential) {
		hide(flashContainer);
		event.preventDefault();
		const options = {
			method: 'post',
			url: `${domain}/api/${authGroupId}/webauthn/finish`,
			headers: {
				Authorization: `bearer ${token}`
			},
			data: {
				accountId,
				credential
			}
		};
		showSpinner();
		const result = await axios(options);
		hideSpinner();
		if(result?.data?.data?.success !== true) throw new Error('not logged in');
		return result.data.data;
	},
	async finishAuth(provider, authGroup, data) {
		//ignoring provider parameter for this implementation
		const options = {
			url: `${API.domain}${API.authWebAuthNFinish}`,
			method: 'post',
			headers: {
				'Content-Type': 'application/json'
			},
			auth: {
				username: authGroup.pluginOptions.webAuthN.meta.privakeyClient,
				password: authGroup.pluginOptions.webAuthN.meta.privakeySecret
			},
			data: {
				accountId: data.accountId,
				credential: data.credential
			}
		};
		const pkey = await axios(options);
		if(!pkey?.data?.requestGuid) {
			throw Boom.failedDependency('auth request unsuccessful');
		}
		const output = JSON.parse(JSON.stringify(pkey.data));
		output.success = true;
		return output;
	},
	async bindWebAuthN(provider, authGroup, data) {
		//ignoring provider parameter for this implementation
		const options = {
			url: `${API.domain}${API.bindWebAuthN}`,
			method: 'put',
			headers: {
				'Content-Type': 'application/json'
			},
			auth: {
				username: authGroup.pluginOptions.webAuthN.meta.privakeyClient,
				password: authGroup.pluginOptions.webAuthN.meta.privakeySecret
			},
			data: {
				accountId: data.accountId,
				userInfo: JSON.stringify({ name: data.email, displayName: data.email }),
				domain: data.domain
			}
		};
		const pkey = await axios(options);
		if(!pkey?.data?.privakeyId) {
			throw Boom.failedDependency('Bind request unsuccessful');
		}
		const output = JSON.parse(JSON.stringify(pkey.data));
		output.success = true;
		return output;
	},
	async finishWebAuthN(provider, authGroup, data) {
		//ignoring provider parameter for this implementation
		const options = {
			url: `${API.domain}${API.finishWebAuthN}`,
			method: 'post',
			headers: {
				'Content-Type': 'application/json'
			},
			auth: {
				username: authGroup.pluginOptions.webAuthN.meta.privakeyClient,
				password: authGroup.pluginOptions.webAuthN.meta.privakeySecret
			},
			data
		};
		const pkey = await axios(options);
		if(!pkey?.data?.privakeyId) {
			throw Boom.failedDependency('Bind request unsuccessful');
		}
		const output = JSON.parse(JSON.stringify(pkey.data));
		output.success = true;
		return output;
	},
	async sendChallenge(provider, authGroup, account, uid, meta) {
		//ignoring provider parameter for this implementation
		const content = (meta?.content) ? {
			title: meta.content.title,
			keys: [{
				key: meta.content.header,
				value: meta.content.body
			}]
		} : {
			title: 'Validation Requested',
			keys: [{
				key: `${authGroup.name} Platform`,
				value: 'If you initiated the action that requires this validation, Approve below. Otherwise click Decline and change your password.'
			}]
		};
		let buttons = [];
		if(!meta?.buttons?.length) {
			buttons = [
				{
					title: 'Approve',
					strongAuth: true,
					style: '{"color":"#16C656"}'
				},
				{
					title: 'Decline',
					strongAuth: false,
					style: '{"color":"#FF6600"}'
				}
			];
		} else {
			meta.buttons.map((b) => {
				buttons.push({
					title: b.title,
					strongAuth: true,
					style: `{"color":"${b.color}"}`
				});
			});
		}
		const callback = `${config.PROTOCOL}://${config.SWAGGER}/api/${authGroup.id}/mfa/callback`;
		const transactionId = { uid, accountId: account.accountId };
		if(meta?.event) transactionId.event = meta.event;
		const data = {
			accountId: account.accountId,
			duration: '5m',
			additionalInfo: {'template':'true'},
			transactionId: JSON.stringify(transactionId),
			notificationTitle: meta?.notification?.title || content.title,
			notificationBody: meta?.notification?.message || content.title,
			callback,
			showCode: true,
			showNotification: true,
			content,
			buttons
		};
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
			data: qs.stringify(data)
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
	},
	async devices(provider, authGroup, account) {
		const options = {
			url: `${API.domain}${API.devices}`,
			method: 'get',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			auth: {
				username: authGroup.config.mfaChallenge.meta.privakeyClient,
				password: authGroup.config.mfaChallenge.meta.privakeySecret
			},
			params: {accountId: account.accountId}
		};
		const result = await axios(options);
		if(!result) throw Boom.failedDependency();
		const output = [];
		// ensuring there is an id...
		result.data?.map((r) => {
			output.push({
				id: r.guid,
				...r
			});
		});
		return output;
	},
	async revoke (provider, authGroup, device) {
		const options = {
			url: `${API.domain}${API.revoke}`,
			method: 'patch',
			headers: {
				'Content-Type': 'application/json'
			},
			auth: {
				username: authGroup.config.mfaChallenge.meta.privakeyClient,
				password: authGroup.config.mfaChallenge.meta.privakeySecret
			},
			data: {
				deviceGuid: device
			}
		};
		return axios(options);
	},
	async challengeCallback(provider, authGroupId, companyId, appSpaceId, reqOriginId) {
		const clientID = provider.privakeySuper.id;
		const clientSecret = provider.privakeySuper.key;
		return pInit.addCallback(clientID, clientSecret, authGroupId, companyId, appSpaceId, reqOriginId);
	},
	async initGroup(authGroup, type, provider) {
		if(type.toLowerCase() === 'privakeysuper') {
			if(!provider.privakeySuper.key) throw Boom.failedDependency('This MFA provider is not set up');
			const clientID = provider.privakeySuper.id;
			const clientSecret = provider.privakeySuper.key;
			const privakey = {};
			// call createCompany
			const company = await pInit.createCompany(clientID, clientSecret, authGroup.name);
			privakey.companyName = company.name;
			privakey.companyId = company.id;
			// call createAppSpace
			// todo default logo....?
			const appSpace = await pInit.createAppSpace(clientID, clientSecret, authGroup.name, company.id, authGroup.config.ui?.skin?.logo);
			privakey.appSpaceId = appSpace.id;
			// call createReqOrigin
			const reqOrigin = await pInit.createReqOrigin(clientID, clientSecret, authGroup.id, company.id, appSpace.id);
			// call createAccessKey
			const keys = await pInit.createAccessKey(clientID, clientSecret, authGroup.id, company.id, appSpace.id, reqOrigin.id);
			// call addCallBack
			const cb = await pInit.addCallback(clientID, clientSecret, authGroup.id, company.id, appSpace.id, reqOrigin.id);
			privakey.callbackId = cb.id;
			// return metadata to update AG
			return {
				privakeyClient: reqOrigin.id,
				privakeySecret: keys.data.key,
				privakey
			};
		}
		return undefined;
	}
};

export default pkApi;