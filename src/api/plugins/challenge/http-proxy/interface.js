import axios from 'axios';
import Boom from '@hapi/boom';
import dal from '../dal';
import group from '../../../authGroup/group';
import client from '../../../oidc/client/clients';

const config = require('../../../../config');

export default {
	async generateToken(provider) {
		const ag = await group.getOneByEither('root', false);
		const cl = await client.getOneFull(ag, provider.proxyClientId);
		const token = await client.generateClientCredentialToken(ag, cl, `api:write group:${ag.id || ag._id}`, provider.api.domain);
		if(token?.data?.access_token) return token.data.access_token;
		throw Boom.failedDependency('Could not generate a token for the global mfa provider');
	},
	async sendChallenge(provider, authGroup, account, uid) {
		const token = await this.generateToken(provider);
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
				interactionDetails: { uid, accountId: account.accountId },
				callback: `${config.PROTOCOL}://${(authGroup.aliasDnsOIDC) ? authGroup.aliasDnsOIDC : config.SWAGGER}/api/mfa/callback`,
				title: 'Authorization Request',
				content: {
					key: `${authGroup.name} Platform`,
					value: 'If you initiated this login, approve below. Otherwise click Decline and change your password.'
				},
				options: ['Approve', 'Decline']
			}
		};
		const result = await axios(options);
		if(!result?.data?.id) throw Boom.failedDependency('Proxy server did not return an ID');
		if(!result?.data?.interactionDetails?.uid || !result?.data?.interactionDetails?.accountId) throw Boom.failedDependency('Proxy server did not return interaction details');
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
	}
};