import Boom from '@hapi/boom';
import plugins from '../plugins';
import privakey from '../challenge/privakey/interface';
import privaPass from './privakey/interface';

const config = require('../../../config');

function switchInterface(provider) {
	switch (provider.type.toLowerCase()) {
	case 'privakey':
		return { pInterface: privakey, provider: provider, alt: privaPass };
	default:
		throw Boom.failedDependency('MFA configuration is currently unhandled - contact the Platform Admin');
	}
}

async function initInterface(global, type) {
	let settings;
	if(!global) {
		settings = await plugins.getLatestPluginOptions();
	} else settings = JSON.parse(JSON.stringify(global));
	const provider = settings.webAuthN.providers.filter((p) => {
		return (p.type === type);
	});
	if(!provider.length) throw Boom.failedDependency('An AG webAuthN provider is specified that is not supported');
	return switchInterface(provider[0]);
}

async function interfaceSelector(ag, global) {
	let settings;
	if(!global) {
		settings = await plugins.getLatestPluginOptions();
	} else settings = JSON.parse(JSON.stringify(global));
	if(ag?.pluginOptions?.webAuthN?.enable === true &&
        settings?.webAuthN?.enabled === true) {
		const provider = settings.webAuthN.providers.filter((p) => {
			return (p.type === ag.pluginOptions.webAuthN.type);
		});
		if(!provider.length) throw Boom.failedDependency('An AG mfa provider is specified that is not supported');
		return switchInterface(provider[0]);
	}
	return undefined;
}

const api = {
	async initGroup(ag, global, type) {
		let settings;
		if(!global) {
			settings = await plugins.getLatestPluginOptions();
		} else settings = JSON.parse(JSON.stringify(global));
		const privaCheck = settings.mfaChallenge.providers.filter((p) => {
			return (p?.type?.toLowerCase() === 'privakey' || p?.type?.toLowerCase() === 'privakeysuper');
		});
		// because there is also a privakey challenge plugin, we want to use those value if it exists for the AG
		if( ag.config.mfaChallenge.enable === true && settings.mfaChallenge.enabled === true) {
			if( ag.config.mfaChallenge?.type?.toLowerCase() === 'privakey' || ag.config.mfaChallenge?.type?.toLowerCase() === 'privakeysuper') {
				if( privaCheck.length &&
					ag.config.mfaChallenge?.meta?.privakeyClient &&
					ag.config.mfaChallenge?.meta?.privakeySecret) {
					return ag.config.mfaChallenge.meta;
				}
			}
		}
		// otherwise create it...
		const { pInterface, provider, alt } = await initInterface(global, type);
		if(alt) return alt.initGroupPasskey(ag, type, provider);
		if(pInterface) return pInterface.initGroup(ag, type, provider);
		throw Boom.badRequest('WebAuthN is not enabled for this Auth Group');
	}
};

export default api;