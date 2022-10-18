const natsMap = new Map();
const NATS_KEY = 'NATSKEY';

export default {
	setInstance(instance) {
		process.env.UE_STREAM_EVENTS = 'on';
		if(natsMap.size >= 1) {
			this.clearInstance();
		}
		return natsMap.set(NATS_KEY, instance);
	},
	getInstance() {
		return natsMap.get(NATS_KEY);
	},
	clearInstance() {
		process.env.UE_STREAM_EVENTS = 'off';
		return natsMap.clear();
	}
};