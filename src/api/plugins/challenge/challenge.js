import Boom from '@hapi/boom';
import dal from './dal';
import plugins from '../plugins';
import privakey from './privakey/interface';
import httpProxy from './http-proxy/interface';

export default {
	async sendChallenge(ag, global, account, uid) {
		// if no global, look it up
		let settings;
		if(!global) {
			settings = await plugins.getLatestPluginOptions();
		} else settings = JSON.parse(JSON.stringify(global));
		// we will simply allow this to pass through if something is not conifigured
		if(ag?.config?.mfaChallenge?.enable === true &&
			account?.mfaEnabled === true && 
			settings?.mfaChallenge?.enabled === true) {
			const provider = settings.mfaChallenge.providers.filter((p) => {
				return (p.type === ag.config.mfaChallenge.type);
			});
			if(!provider.length) throw Boom.failedDependency('An AG mfa provider is specified that is not supported by the Platform at this time');
			switch (provider[0].type.toLowerCase()) {
			case 'http-proxy':
				return httpProxy.sendChallenge(provider[0], ag, account, uid);
			case 'privakey':
				return privakey.sendChallenge(ag, account, uid);
			default:
				throw Boom.failedDependency('MFA configuration is currently unhandled - contact the Platform Admin');
			}
		}
		return undefined;
	},
	async saveChallenge(data) {
		return dal.saveChallenge(data);
	},
	async callback(data) {
		return dal.findChallengeAndUpdate(data);
	},
	async status(query) {
		return dal.status(query);
	},

	async validateRequest(id, api) {
		switch (api.name.toLowerCase()) {
		case 'privakey':
		    //todo ag parameter pass
			return privakey.validateRequest(id, api.meta);
		case 'http-proxy':
			//todo ag parameter pass
			//return httpProxy.validateRequest(id, api.meta);
			break;
		default:
			throw Boom.badRequest('Unknown MFA interface specified');
                
		}
	}
};