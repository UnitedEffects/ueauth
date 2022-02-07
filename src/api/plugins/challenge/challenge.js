import Boom from '@hapi/boom';
import dal from './dal';
import acc from '../../accounts/account';
import plugins from '../plugins';
import iat from '../../oidc/initialAccess/iat';
import notify from '../notifications/notifications';
import logs from '../../logging/logs';
import privakey from './privakey/interface';
import httpProxy from './http-proxy/interface';

const config = require('../../../config');

async function interfaceSelector(ag, global) {
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
			return { pInterface: httpProxy, provider: provider[0] };
		case 'privakey':
			return { pInterface: privakey, provider: provider[0] };
		default:
			throw Boom.failedDependency('MFA configuration is currently unhandled - contact the Platform Admin');
		}
	}
	return undefined;
}

const chApi = {
	async bindInstructions(ag, global, bindData) {
		const { pInterface, provider } = await interfaceSelector(ag, global);
		if(pInterface) return pInterface.bindInstructions(provider, bindData);
		return undefined;
	},
	async devices(ag, global, account) {
		const { pInterface, provider } = await interfaceSelector(ag, global);
		if(pInterface) return pInterface.devices(provider, ag, account);
		return undefined;
	},
	async revoke(ag, global, device) {
		const { pInterface, provider } = await interfaceSelector(ag, global);
		if(pInterface) return pInterface.revoke(provider, ag, device);
		return undefined;
	},
	async bindUser(ag, global, account) {
		const { pInterface, provider } = await interfaceSelector(ag, global);
		if(pInterface) return pInterface.bindUser(provider, ag, account);
		return undefined;
	},
	async sendChallenge(ag, global, account, uid, meta) {
		const { pInterface, provider } = await interfaceSelector(ag, global);
		if(pInterface) return pInterface.sendChallenge(provider, ag, account, uid, meta);
		return undefined;
	},
	async saveChallenge(data) {
		return dal.saveChallenge(data);
	},
	async callback(ag, global, data) {
		const { pInterface, provider } = await interfaceSelector(ag, global);
		if(pInterface) return pInterface.findChallengeAndUpdate(provider, ag, data);
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
	},
	async revokeAllDevices(authGroup, global, mfaAcc) {
		let devices;
		const warnings = [];
		try {
			devices = await chApi.devices(authGroup, global, mfaAcc);
		} catch (e) {
			if (e.response?.status !== 404) {
				console.error(e);
				await logs.detail('ERROR', `Unable to retrieve device list for ${mfaAcc.accountId}`, e);
				warnings.push({
					message: `Unable to retrieve device list for ${mfaAcc.accountId}`
				});
			}
		}
		if (devices) {
			await Promise.all(devices.map(async (device) => {
				if (device?.id) {
					try {
						await chApi.revoke(authGroup, global, device.id);
					} catch (e) {
						console.error(e);
						const details = {
							device: device.id,
							message: 'Unable to revoke this device'
						};
						await logs.detail('ERROR', `unable to revoke device ${device.id}`, details);
						warnings.push(details);
					}
				}
				return device;
			}));
		}
		return warnings;
	}
};

export default chApi;