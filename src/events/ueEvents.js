import UEStreams from './ueStreams';
import factory from './factory';
import stream from '../api/plugins/eventStream/eventStream';
import { v4 as uuid } from 'uuid';
const ueStreams = new UEStreams();

const et = {
	stream(groupId) {
		return ueStreams.find(groupId);
	},
	emit(groupId, event, data) {
		const e = `${event}:${groupId}`;
		ueStreams.find(groupId).emit(e, data);
	},
	async master(group, event, data) {
		const emit = {
			id: uuid(), //to help find this in a log
			group,
			event: event,
			eventTime: Date.now(),
			data
		};
		emit.data = factory.cleanArgs([data]);
		return stream.master(group, emit);
	}
};



export default et;