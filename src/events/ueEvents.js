import events from 'events';
import factory from './factory';
import NodeCache from 'node-cache';

const stream = new events.EventEmitter();
const myCache = new NodeCache();
const config = require('../config');

const et = {
	stream,
	emit(groupId, event, data) {
		const e = `${event}:${groupId}`;
		et.stream.emit(e, data);
	},
	async eventEmitter(group) {
		const groupId = group.id || group._id;
		const isSet = await myCache.get(`ue.events.${groupId}`);
		if(isSet !== true) {
			console.info(`Building API Listeners for AG: ${groupId}`);
			const clean = config.EVENT_EMITTER_CLEAN_SENSITIVE;
			const list = factory.getEventList();
			list.forEach((item) => {
				if(factory.items[item]){
					factory.items[item].forEach((event) => {
						const e = `${event}:${groupId}`;
						const temp = et.stream._events;
						if(!Object.keys(temp).includes(e)) {
							factory.processProviderStream(et.stream, e, clean, group, true);
						}
					});
				}
			});
			myCache.set(`ue.events.${groupId}`, true);
		}
	}
};



export default et;