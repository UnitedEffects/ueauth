import dal from './dal';
import axios from 'axios';
import client from '../../oidc/client/clients';
import group from '../../authGroup/group';

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
	async sendNotification(notification, global){
		if(!notification.destinationUri || !notification.id) throw new Error('Requested notification does not seem to be valid');
		const payload = JSON.parse(JSON.stringify(notification));
		if(payload.processed) delete payload.processed;
		const ag = await group.getOneByEither('root', false);
		const cl = await client.getOne(ag, global.notifications.registeredClientId);
		const token = await client.generateClientCredentialToken(ag, cl, `openid api:notifications group:${ag.id}`);
		const options = {
			method: 'POST',
			headers: {
				'Authorization': `bearer ${token}`
			},
			data: payload,
			url: notification.destinationUri
		}
		const result = await axios(options);
		await dal.markProcessed(notification.id);
		return result;
	},
};