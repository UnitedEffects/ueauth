import factory from './factory';
import NodeCache from 'node-cache';
const myCache = new NodeCache();
const config = require('../config');

const et = {
	providerEventEmitter(provider, group) {
		const groupId = group.id || group._id;
		const isSet = myCache.get(`oidc.events.${groupId}`);
		if(isSet !== true) {
			console.info(`Building OP Listeners for AG: ${groupId}`);
			const clean = config.EVENT_EMITTER_CLEAN_SENSITIVE;
			const list = factory.getEventList();
			list.forEach((item) => {
				factory.items[item].forEach((event) => {
					const temp = provider._events;
					if (!Object.keys(temp).includes(event)) {
						factory.processProviderStream(provider, event, clean, group);
					}
				});
			});
			myCache.set(`oidc.events.${groupId}`, true);
		}
	}
};

export default et;