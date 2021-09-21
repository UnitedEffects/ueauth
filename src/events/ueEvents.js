import events from 'events';
import {v4 as uuid} from 'uuid';
import factory from './factory';

const stream = new events.EventEmitter();
const testing = uuid();
const et = {
	stream,
	testing,
	eventEmitter(group) {
		const clean = group.config.eventEmitterCleanSensative;
		const list = factory.getEventList(group);
		list.forEach((item) => {
			factory.items[item].forEach((event) => {
				const e = `${event}-${group.id || group._id}`;
				const temp = et.stream._events;
				if(!Object.keys(temp).includes(e)) {
					factory.processProviderStream(et.stream, e, clean, group, true);
				}
			});
		});
	}
};



export default et;