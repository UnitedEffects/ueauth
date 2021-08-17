import dal from './dal';
import axios from 'axios';
import client from '../../oidc/client/clients';
import group from '../../authGroup/group';
import helper from "../../../helper";

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
	async processNotification(global, ag, id) {
		const notification = await dal.getNotification(ag.id, id);
		if(!notification) throw new Error(`Unknown notification id: ${id}`)
		if(notification.processed === true) return notification;
		await this.sendNotification(notification, global);
		notification.processed = true;
		return notification;
	},
	async bulkNotificationProcess(global, agId) {
		const notificationsNotProcessed = await dal.notificationsNotProcessed(agId);
		let output = [];
		const agR = await group.getOneByEither('root', false);
		const cl = await client.getOne(agR, global.notifications.registeredClientId);
		const token = await client.generateClientCredentialToken(agR, cl, `openid api:notifications group:${agR.id}`);
		for(let i=0; i<notificationsNotProcessed.length; i++) {
			try {
				await this.sendNotification(notificationsNotProcessed[i], global, token);
				notificationsNotProcessed[i].processed = true;
				output.push(notificationsNotProcessed[i]);
			} catch (error) {
				output.push(notificationsNotProcessed[i]);
			}
		}
		return output;
	},
	async sendNotification(notification, global, token = null){
		if(!notification.destinationUri || !notification.id) throw new Error('Requested notification does not seem to be valid');
		const payload = JSON.parse(JSON.stringify(notification));
		if(payload.processed) delete payload.processed;
		if(!token){
			const ag = await group.getOneByEither('root', false);
			const cl = await client.getOneFull(ag, global.notifications.registeredClientId);
			token = await client.generateClientCredentialToken(ag, cl, `api:write group:${ag.id}`, global.notifications.notificationServiceUri);
		}
		const options = {
			method: 'POST',
			headers: {
				'Authorization': `bearer ${token.data.access_token}`
			},
			data: payload,
			url: notification.destinationUri
		}
		const result = await axios(options);
		await dal.markProcessed(notification.id);
		return result;
	},
	async getNotifications(ag, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getNotifications(ag.id, query);
	},
	async getNotification(ag, id) {
		return dal.getNotification(ag.id, id);
	},
	async deleteNotification(ag, id) {
		return dal.deleteNotification(ag.id, id);
	},
	async notify(global, data, ag) {
		data.authGroupId = ag.id;
		data.destinationUri = global.notifications.notificationServiceUri;
		let notification;
		try {
			notification = await this.createNotification(data);
			await this.sendNotification(notification, global);
			return notification;
		} catch (error) {
			if(notification) {
				await this.deleteNotification(ag, notification.id);
			}
			throw error;
		}

	}
};