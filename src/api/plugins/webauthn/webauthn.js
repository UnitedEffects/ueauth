import Boom from '@hapi/boom';
import plugins from '../plugins';
import privakey from '../challenge/privakey/interface';
import privaPass from './privakey/interface';

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
	async reqWebAuthN(ag, global, data) {
		const { pInterface, provider } = await interfaceSelector(ag, global);
		if(pInterface) return pInterface.reqWebAuthN(provider, ag, data);
		return undefined;
	},
	async finishAuth(ag, global, data) {
		const { pInterface, provider } = await interfaceSelector(ag, global);
		if(pInterface) return pInterface.finishAuth(provider, ag, data);
		return undefined;
	},
	async bindWebAuthN(ag, global, data) {
		const { pInterface, provider } = await interfaceSelector(ag, global);
		if(pInterface) return pInterface.bindWebAuthN(provider, ag, data);
		return undefined;
	},
	async finishWebAuthN(ag, global, data) {
		const { pInterface, provider } = await interfaceSelector(ag, global);
		if(pInterface) return pInterface.finishWebAuthN(provider, ag, data);
		return undefined;
	},
	async initGroup(ag, global, type, domain) {
		let settings;
		if(!global) {
			settings = await plugins.getLatestPluginOptions();
		} else settings = JSON.parse(JSON.stringify(global));
		const { pInterface, provider, alt } = await initInterface(global, type);
		const privaCheck = settings.mfaChallenge.providers.filter((p) => {
			return (p?.type?.toLowerCase() === 'privakey' || p?.type?.toLowerCase() === 'privakeysuper');
		});
		// because there is also a privakey challenge plugin, we want to use those value if it exists for the AG
		if( ag.config.mfaChallenge.enable === true && settings.mfaChallenge.enabled === true) {
			if( ag.config.mfaChallenge?.type?.toLowerCase() === 'privakey' || ag.config.mfaChallenge?.type?.toLowerCase() === 'privakeysuper') {
				if( privaCheck.length &&
					ag.config.mfaChallenge?.meta?.privakeyClient &&
					ag.config.mfaChallenge?.meta?.privakeySecret) {
					console.info('matching data...');
					const meta = JSON.parse(JSON.stringify(ag.config.mfaChallenge.meta));
					const wCB = await alt.createCallback(ag.id, provider, meta.privakey.companyId, meta.privakey.appSpaceId, ag.config.mfaChallenge?.meta?.privakeyClient, domain);
					meta.privakey.callbackId = wCB.id;
					return meta;
				}
			}
		}
		// otherwise create it...
		if(alt) return alt.initGroupPasskey(ag, type, provider);
		if(pInterface) return pInterface.initGroup(ag, type, provider);
		throw Boom.badRequest('WebAuthN is not enabled for this Auth Group');
	}
};

export default api;