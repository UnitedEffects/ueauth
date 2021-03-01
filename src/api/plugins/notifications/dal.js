import Notify from './model';

export default {
	async createNotification(data) {
		const notify = new Notify(data);
		return notify.save();
	},
	async markProcessed(id) {
		return Notify.findOneAndUpdate({ _id: id}, { processed: true }, { new: true });
	}
};