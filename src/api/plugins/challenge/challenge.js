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

function switchInterface(provider) {
	switch (provider.type.toLowerCase()) {
	case 'http-proxy':
		return { pInterface: httpProxy, provider: provider };
	case 'privakeysuper':
	case 'privakey':
		return { pInterface: privakey, provider: provider };
	default:
		throw Boom.failedDependency('Device Challenge configuration is currently unhandled - contact the Platform Admin');
	}
}

async function initInterface(global, type) {
	let settings;
	if(!global) {
		settings = await plugins.getLatestPluginOptions();
	} else settings = JSON.parse(JSON.stringify(global));
	const provider = settings.mfaChallenge.providers.filter((p) => {
		return (p.type === type);
	});
	if(!provider.length) throw Boom.failedDependency('An AG device challenge provider is specified that is not supported');
	return switchInterface(provider[0]);
}

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
		if(!provider.length) throw Boom.failedDependency('An AG device challenge provider is specified that is not supported');
		return switchInterface(provider[0]);
	}
	return undefined;
}

const chApi = {
	async bindInstructions(ag, global, bindData, displayName) {
		const { pInterface, provider } = await interfaceSelector(ag, global);
		if(pInterface) return pInterface.bindInstructions(provider, bindData, displayName);
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
		throw Boom.badRequest('Device Challenges are not enabled for this Auth Group');
	},
	async status(query) {
		return dal.status(query);
	},
	async clearStatus(query) {
		return dal.clearStatus(query);
	},
	async emailVerify(authGroup, global, account, state, customDomain) {
		const user = await acc.getAccount(authGroup.id, account);
		const meta = {
			sub: user.id,
			email: user.email,
			uid: state
		};
		const code = await iat.generateIAT(360, ['auth_group'], authGroup, meta);
		const notifyOptions = {
			iss: `${config.PROTOCOL}://${
				customDomain ? customDomain : config.SWAGGER
			}/${authGroup.id}`,
			createdBy: account,
			type: 'general',
			formats: ['email'],
			recipientUserId: account,
			recipientEmail: user.email,
			subject: `${authGroup.name} Platform - Device Identity Verification`,
			message: `This code will be valid for 5 minutes. Please copy and paste it into the Device Recover Window input field to proceed with your Device recovery.\n\n\n${code.jti}`
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
	},
	async initGroup(ag, global, type) {
		let settings;
		if(!global) {
			settings = await plugins.getLatestPluginOptions();
		} else settings = JSON.parse(JSON.stringify(global));
		const { pInterface, provider } = await initInterface(global, type);
		const privaCheck = settings.mfaChallenge.providers.filter((p) => {
			return (p?.type?.toLowerCase() === 'privakey');
		});
		// because there is also a privakey webAuthN plugin, we want to use those value if it exists for the AG
		if( ag.pluginOptions.webAuthN.enable === true && settings.webAuthN.enabled === true) {
			if( ag.pluginOptions.webAuthN?.type?.toLowerCase() === 'privakey') {
				if( privaCheck.length &&
					ag.pluginOptions.webAuthN?.meta?.privakeyClient &&
					ag.pluginOptions.webAuthN?.meta?.privakeySecret) {
					const meta = JSON.parse(JSON.stringify(ag.pluginOptions.webAuthN.meta));
					const CB = await pInterface.challengeCallback(provider, ag.id, meta.privakey.companyId, meta.privakey.appSpaceId, ag.pluginOptions.webAuthN?.meta?.privakeyClient);
					meta.privakey.callbackId = CB.id;
					return meta;
				}
			}
		}
		// otherwise create it...
		if(pInterface) return pInterface.initGroup(ag, type, provider);
		throw Boom.badRequest('Device Challenges are not enabled for this Auth Group');
	}
};

export default chApi;