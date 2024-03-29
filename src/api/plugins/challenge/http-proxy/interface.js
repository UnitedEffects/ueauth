import axios from 'axios';
import Boom from '@hapi/boom';
import dal from '../dal';
import group from '../../../authGroup/group';
import client from '../../../oidc/client/clients';
import events from '../eventProcessor';

const config = require('../../../../config');

const httpProxyApi = {
	async bindInstructions(provider, bindData, displayName) {
		const instructions = provider?.proxyEnableInstructions.replace(/</g, '&lt;').replace(/>/g, '&gt;').split('--');
		const out = {
			instructions,
			displayName,
			setupScreen: `${provider.proxyEnableScreen}?`,
			setupScreenButtonText: provider.proxyEnableScreenButtonText,
			qrCode: bindData.qrCode || false
		};
		const data = (Array.isArray(bindData)) ? bindData[0] : bindData;
		if(typeof data === 'object') {
			Object.keys(bindData).map((key) => {
				out.setupScreen = `${out.setupScreen}${key}=${bindData[key]}&`;
			});
		}
		if(typeof data === 'string') {
			out.setupScreen = `${out.setupScreen}params=${data}`;
		}
		return out;
	},
	async findChallengeAndUpdate(provider, ag, data) {
		if(!data.id) throw Boom.badRequest('No id provided');
		if(!Object.keys(data).includes('action')) throw Boom.badRequest('No action indicated');
		const state = (data.action === 0) ? 'approved' : 'denied';
		if(!data?.interactionDetails?.uid) throw Boom.badRequest('No interaction id found');
		if(!data?.interactionDetails?.accountId) throw Boom.badRequest('No account id found');
		const uid = data.interactionDetails.uid;
		const accountId = data.interactionDetails.accountId;
		const validate = await httpProxyApi.validateRequest(provider, data.id);
		if(validate?.data?.id !== data.id ||
			validate?.data?.interactionDetails?.uid !== data.interactionDetails.uid ||
			validate?.data?.interactionDetails?.accountId !== data.interactionDetails.accountId ||
			validate?.data?.action !== data.action) {
			throw Boom.badRequest('Invalid Callback Detected');
		}
		const update = {
			uid,
			accountId,
			providerKey: data.id,
			authGroup: ag.id,
			state
		};
		const result = await dal.findChallengeAndUpdate(update);
		// if there is an event in the message, we process
		await events.processEvent(data?.interactionDetails, ag, accountId, uid, result);
		return result;
	},
	async bindUser(provider, authGroup, account) {
		const token = await this.generateToken(provider);
		const options = {
			url: `${provider.api.domain}${provider.api.bind}`,
			method: 'put',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			data: {
				accountId: account.accountId
			}
		};
		const result = await axios(options);
		if(!result?.data?.id) {
			throw Boom.failedDependency('Bind request unsuccessful');
		}
		return result.data;
	},
	async generateToken(provider) {
		const ag = await group.getOneByEither('root', false);
		const cl = await client.getOneFull(ag, provider.proxyClientId);
		const token = await client.generateClientCredentialToken(ag,
			cl,
			`api:write group:${ag.id || ag._id}`,
			provider.api.domain);
		if(token?.data?.access_token) return token.data.access_token;
		throw Boom.failedDependency('Could not generate a token for the global mfa provider');
	},
	async sendChallenge(provider, authGroup, account, uid, meta) {
		const token = await this.generateToken(provider);
		const content =  meta?.content || {
			title: 'Validation Requested',
			header: `${authGroup.name} Platform`,
			body: 'If you initiated the action that requires this validation, Approve below. Otherwise click Decline and change your password.'
		};
		const interactionDetails = { uid, accountId: account.accountId };
		if(meta?.event) interactionDetails.event = meta.event;
		const options = {
			url: `${provider.api.domain}${provider.api.challenge}`,
			method: 'post',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			data: {
				accountId: account.accountId,
				duration: '5m',
				interactionDetails,
				callback: `${config.PROTOCOL}://${(authGroup.aliasDnsOIDC) ? 
					authGroup.aliasDnsOIDC : config.SWAGGER}/api/mfa/callback`,
				content,
				options: meta?.buttons || [
					{
						title: 'Approve',
						color: 'green'
					},
					{
						title: 'Decline',
						color: 'red'
					}
				],
				notification: meta?.notification || {
					title: content.title,
					message: content.title
				}
			}
		};
		const result = await axios(options);
		if(!result?.data?.id) throw Boom.failedDependency('Proxy server did not return an ID');
		if(!result?.data?.interactionDetails?.uid ||
			!result?.data?.interactionDetails?.accountId) {
			throw Boom.failedDependency('Proxy server did not return interaction details');
		}
		try {
			await dal.saveChallenge({
				authGroup: authGroup.id,
				providerKey: result.data.id,
				uid,
				accountId: account.accountId,
				state: 'pending'
			});
		} catch (error) {
			if(error.code !== 11000) throw error;
			//skipping dups
		}
		return {
			id: result.data.id,
			provider: 'http-proxy',
			response: result.data
		};
	},
	async validateRequest(provider, id) {
		const token = await this.generateToken(provider);
		const options = {
			url: `${provider.api.domain}${provider.api.validate}`,
			method: 'get',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			params: {requestId: id}
		};
		return axios(options);
	},
	async devices(provider, authGroup, account) {
		const token = await this.generateToken(provider);
		const options = {
			url: `${provider.api.domain}${provider.api.devices}`,
			method: 'get',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			params: {accountId: account.accountId}
		};
		const result = await axios(options);
		if(!result?.data) throw Boom.failedDependency();
		return result.data;
	},
	async revoke (provider, authGroup, device) {
		const token = await this.generateToken(provider);
		const options = {
			url: `${provider.api.domain}${provider.api.revoke}`,
			method: 'post',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			data: {
				deviceId: device
			}
		};
		return axios(options);
	},
	async initGroup(authGroup, type, provider) {
		// just here for consistency with the interface
		return undefined;
	}
};

export default httpProxyApi;