import Boom from '@hapi/boom';
import dal from './dal';
import acc from '../../accounts/account';
import plugins from '../plugins';
import privakey from './privakey/interface';
import httpProxy from './http-proxy/interface';
import iat from '../../oidc/initialAccess/iat';
import notify from '../notifications/notifications';

const config = require('../../../config');

export default {
	async bindInstructions(ag, global, bindData) {
		let settings;
		if(!global) {
			settings = await plugins.getLatestPluginOptions();
		} else settings = JSON.parse(JSON.stringify(global));
		if(ag?.config?.mfaChallenge?.enable === true &&
			settings?.mfaChallenge?.enabled === true) {
			const provider = settings.mfaChallenge.providers.filter((p) => {
				return (p.type === ag.config.mfaChallenge.type);
			});
			if(!provider.length) throw Boom.failedDependency('An AG mfa provider is specified that is not supported');
			switch (provider[0].type.toLowerCase()) {
			case 'http-proxy':
				return httpProxy.bindInstructions(provider[0], bindData);
			case 'privakey':
				return privakey.bindInstructions(provider[0], bindData);
			default:
				throw Boom.failedDependency('MFA configuration is currently unhandled - contact the Platform Admin');
			}
		}
		return undefined;
	},
	async devices(ag, global, account) {
		let settings;
		if(!global) {
			settings = await plugins.getLatestPluginOptions();
		} else settings = JSON.parse(JSON.stringify(global));
		if(ag?.config?.mfaChallenge?.enable === true &&
			settings?.mfaChallenge?.enabled === true) {
			const provider = settings.mfaChallenge.providers.filter((p) => {
				return (p.type === ag.config.mfaChallenge.type);
			});
			if (!provider.length) throw Boom.failedDependency('An AG mfa provider is specified that is not supported');
			switch (provider[0].type.toLowerCase()) {
			case 'http-proxy':
				return httpProxy.devices(provider[0], ag, account);
			case 'privakey':
				return privakey.devices(provider[0], ag, account);
			default:
				throw Boom.failedDependency('MFA configuration is currently unhandled - contact the Platform Admin');
			}
		}
		return undefined;
	},
	async revoke(ag, global, device) {
		let settings;
		if(!global) {
			settings = await plugins.getLatestPluginOptions();
		} else settings = JSON.parse(JSON.stringify(global));
		if(ag?.config?.mfaChallenge?.enable === true &&
			settings?.mfaChallenge?.enabled === true) {
			const provider = settings.mfaChallenge.providers.filter((p) => {
				return (p.type === ag.config.mfaChallenge.type);
			});
			if (!provider.length) throw Boom.failedDependency('An AG mfa provider is specified that is not supported');
			switch (provider[0].type.toLowerCase()) {
			case 'http-proxy':
				return httpProxy.revoke(provider[0], ag, device);
			case 'privakey':
				return privakey.revoke(provider[0], ag, device);
			default:
				throw Boom.failedDependency('MFA configuration is currently unhandled - contact the Platform Admin');
			}
		}
		return undefined;
	},
	async bindUser(ag, global, account) {
		let settings;
		if(!global) {
			settings = await plugins.getLatestPluginOptions();
		} else settings = JSON.parse(JSON.stringify(global));
		if(ag?.config?.mfaChallenge?.enable === true &&
			settings?.mfaChallenge?.enabled === true) {
			const provider = settings.mfaChallenge.providers.filter((p) => {
				return (p.type === ag.config.mfaChallenge.type);
			});
			if(!provider.length) throw Boom.failedDependency('An AG mfa provider is specified that is not supported');
			switch (provider[0].type.toLowerCase()) {
			case 'http-proxy':
				return httpProxy.bindUser(provider[0], ag, account);
			case 'privakey':
				return privakey.bindUser(provider[0], ag, account);
			default:
				throw Boom.failedDependency('MFA configuration is currently unhandled - contact the Platform Admin');
			}
		}
		return undefined;
	},
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
	},
	async emailVerify(authGroup, global, account, state) {
		const user = await acc.getAccount(authGroup.id, account);
		const meta = {
			sub: user.id,
			email: user.email,
			uid: state
		};
		const code = await iat.generateIAT(360, ['auth_group'], authGroup, meta);
		const notifyOptions = {
			iss: `${config.PROTOCOL}://${
				authGroup.aliasDnsOIDC ? authGroup.aliasDnsOIDC : config.SWAGGER
			}/${authGroup.id}`,
			createdBy: account,
			type: 'general',
			formats: ['email'],
			recipientUserId: account,
			recipientEmail: user.email,
			subject: `${authGroup.name} Platform - MFA Identity Verification`,
			message: `This code will be valid for 5 minutes. Please copy and paste it into the MFA Recover Window input field to proceed with your MFA recovery.\n\n\n${code.jti}`
		};

		return notify.notify(global, notifyOptions, authGroup);
	}
};