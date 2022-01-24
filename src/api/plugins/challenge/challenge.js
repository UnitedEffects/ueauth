import Boom from '@hapi/boom';
import dal from './dal';
import plugins from '../plugins';
import privakey from './privakey/interface';
import httpProxy from './http-proxy/interface';

export default {
	async sendChallenge(ag, global, account, uid) {
		let settings;
		if(!global) {
			settings = await plugins.getLatestPluginOptions();
		} else settings = JSON.parse(JSON.stringify(global));
		if(ag?.config?.mfaChallenge?.enable === true &&
			account?.mfaEnabled === true && 
			settings?.mfaChallenge?.enabled === true) {
			const provider = settings.mfaChallenge.providers.filter((p) => {
				return (p.type === ag.config.mfaChallenge.type);
			});
			if(!provider.length) throw Boom.failedDependency('An AG mfa provider is specified that is not supported');
			switch (provider[0].type.toLowerCase()) {
			case 'http-proxy':
				return httpProxy.sendChallenge(provider[0], ag, account, uid);
			case 'privakey':
				return privakey.sendChallenge(provider[0], ag, account, uid);
			default:
				throw Boom.failedDependency('MFA configuration is currently unhandled - contact the Platform Admin');
			}
		}
		return undefined;
	},
	async saveChallenge(data) {
		return dal.saveChallenge(data);
	},
	async callback(ag, global, data) {
		let settings;
		if(!global) {
			settings = await plugins.getLatestPluginOptions();
		} else settings = JSON.parse(JSON.stringify(global));
		if(ag?.config?.mfaChallenge?.enable === true &&
			settings?.mfaChallenge?.enabled === true) {
			const provider = settings.mfaChallenge.providers.filter((p) => {
				return (p.type === ag.config.mfaChallenge.type);
			});
			if(!provider.length) {
				throw Boom.failedDependency('An AG mfa provider is specified that is not supported by the Platform');
			}
			switch (provider[0].type.toLowerCase()) {
			case 'http-proxy':
				return httpProxy.findChallengeAndUpdate(provider[0], ag, data);
			case 'privakey':
				return privakey.findChallengeAndUpdate(provider[0], ag, data);
			default:
				throw Boom.failedDependency('MFA configuration is currently unhandled - contact the Platform Admin');
			}
		}
		throw Boom.badRequest('MFA is not enabled for this Auth Group');
	},
	async status(query) {
		return dal.status(query);
	}
};