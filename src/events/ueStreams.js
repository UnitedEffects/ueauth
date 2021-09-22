import events from 'events';
import factory from './factory';

const config = require('../config');

class UEStreams {
	constructor() {
		this.streamList = {};
	}
	getStream(agId) {
		return this.streamList[agId];
	}
	deleteStream(agId) {
		this.streamList[agId].removeAllListeners();
		delete this.streamList[agId];
	}
	newStream(agId) {
		// manage the number of instances
		if(Object.keys(this.streamList).length > 100) {
			const oldStream = Object.keys(this.streamList)[0];
			this.deleteStream(oldStream);
		}
		this.streamList[agId] = new events.EventEmitter();
		return this.streamList[agId];
	}
	find(agId) {
		const myStream = this.streamList[agId];
		if(!myStream) {
			const ns = this.newStream(agId);
			eventEmitter(ns, agId);
			return ns;
		}
		return myStream;
	}
}

function eventEmitter(stream, groupId) {
	const clean = config.EVENT_EMITTER_CLEAN_SENSITIVE;
	const list = factory.getEventList();
	console.info(`Building API Listeners for AG: ${groupId}`);
	list.forEach((item) => {
		if(factory.items[item]){
			factory.items[item].forEach((event) => {
				const e = `${event}:${groupId}`;
				const temp = stream._events;
				if(!Object.keys(temp).includes(e)) {
					factory.processProviderStream(stream, e, clean, groupId, true);
				}
			});
		}
	});
}

export default UEStreams;