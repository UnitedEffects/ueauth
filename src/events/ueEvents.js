import UEStreams from './ueStreams';
const ueStreams = new UEStreams();

const et = {
	stream(groupId) {
		return ueStreams.find(groupId);
	},
	emit(groupId, event, data) {
		const e = `${event}:${groupId}`;
		ueStreams.find(groupId).emit(e, data);
	}
};



export default et;