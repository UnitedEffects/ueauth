import factory from './factory';

const et = {
	providerEventEmitter(provider, group) {
		const clean = group.config.eventEmitterCleanSensative;
		const list = factory.getEventList(group);
		list.forEach((item) => {
			factory.items[item].forEach((event) => {
				const temp = provider._events;
				if(!Object.keys(temp).includes(event)) {
					factory.processProviderStream(provider, event, clean, group);
				}
			});
		});
	}
};

export default et;