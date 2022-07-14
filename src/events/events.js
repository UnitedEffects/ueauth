import factory from './factory';
const config = require('../config');

const et = {
	// This only ever gets called the first time the provider is created
	async providerEventEmitter(provider, group) {
		const groupId = group.id || group._id;
		if(config.ENV !== 'production') console.info(`Building OP Listeners for AG: ${groupId}`);
		const clean = config.EVENT_EMITTER_CLEAN_SENSITIVE;
		const list = factory.getEventList();
		list.forEach((item) => {
			factory.items[item].forEach((event) => {
				const temp = provider._events;
				if (!Object.keys(temp).includes(event)) {
					factory.processProviderStream(provider, event, clean, groupId);
				}
			});
		});
	}
};

export default et;