import dal from './dal';
import axios from 'axios';

export default {
	async createNotification(data) {
		return dal.createNotification(data);
	},
	async markNotificationProcessed(id) {
		return dal.markProcessed(id);
	},
	async sendNotificationById(id) {
		const notification = await dal.getOne(id);
		if(!notification) throw new Error(`Unknown notification id: ${id}`)
		return this.sendNotification(notification);
	},
	async sendNotification(notification){
		if(!notification.destinationUri || !notification.id) throw new Error('Requested notification does not seem to be valid');
		const payload = JSON.parse(JSON.stringify(notification));
		if(payload.processed) delete payload.processed;
		const result = await axios.post(notification.destinationUri, payload);
		console.info('should not get here on error');
		await dal.markProcessed(notification.id);
		return result;
	},
};