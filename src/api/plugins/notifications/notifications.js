import dal from './dal';

export default {
	async createNotification(data) {
		return dal.createNotification(data);
	},
	async markNotificationProcessed(id) {
		return dal.markProcessed(id);
	}
};