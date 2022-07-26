import plugins from '../plugins';
import Boom from '@hapi/boom';
import pulsar from './pulsar/interface';


async function activeInterfaceSelector(ag, global) {
	let settings;
	if(!global) {
		settings = await plugins.getLatestPluginOptions();
	} else settings = JSON.parse(JSON.stringify(global));
	if(ag?.pluginOptions?.externalStreaming?.enabled === true &&
        settings?.eventStream?.enabled === true) {
		const provider = settings.eventStream?.provider;
		switch (provider.type.toLowerCase()) {
		case 'pulsar':
			return { i: pulsar, provider };
		default:
			throw Boom.failedDependency('Unknown event stream provider type');
		}
	}
	return undefined;
}

async function generalInterfaceSelector(providerType) {
	switch (providerType.toLowerCase()) {
	case 'pulsar':
		return pulsar;
	default:
		throw Boom.failedDependency('Unknown event stream provider type');
	}
}

export default {
	async validateProvider(provider) {
		const stream = await generalInterfaceSelector(provider?.type);
		return stream.validateSettings(provider);
	},
	async initializeAG(ag, global) {
		const stream = await activeInterfaceSelector(ag, global);
		const group = JSON.parse(JSON.stringify(ag));
		if(!stream) throw Boom.failedDependency('No external streaming interface available');
		return stream.i.initializeAG(group, stream.provider);
	},
	async publish(ag, data) {
		const stream = await activeInterfaceSelector(ag);
		if(!stream) throw Boom.failedDependency('No external streaming interface available');
		return stream.i.publish(ag, data, stream.provider);
	},
	async master(ag, data) {
		try {
			const settings = await plugins.getLatestPluginOptions();
			if(settings?.eventStream?.provider?.masterStream?.enabled === true &&
				settings?.eventStream?.provider?.masterStream?.streamPath &&
				settings?.eventStream?.provider?.type) {
				const stream = await generalInterfaceSelector(settings.eventStream.provider.type);
				if (!stream) throw Boom.failedDependency('No external streaming interface available');
				return stream.publishMaster(ag, data, settings.eventStream.provider);
			}
		} catch (error) {
			console.error(error);
			return undefined;
		}
	},
	async clean() {
		const settings = await plugins.getLatestPluginOptions();
		const stream = await generalInterfaceSelector(settings.eventStream.provider.type);
		return stream.clean();
	}
};