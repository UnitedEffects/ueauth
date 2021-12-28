import dal from './dal';
import axios from 'axios';
import client from '../../oidc/client/clients';
import group from '../../authGroup/group';
import helper from '../../../helper';
import plugins from '../plugins';
import ueEvents from '../../../events/ueEvents';

export default {
	async createNotification(data) {
		const result = await dal.createNotification(data);
		ueEvents.emit(data.authGroupId, 'ue.plugin.notification.create', result);
		return result;
	},
	// @notTested
	async markNotificationProcessed(id) {
		return dal.markProcessed(id);
	},
	// @notTested
	async sendNotificationById(id) {
		const notification = await dal.getOne(id);
		if(!notification) throw new Error(`Unknown notification id: ${id}`);
		return this.sendNotification(notification);
	},
	async processNotification(global, ag, id) {
		const notification = await dal.getNotification(ag.id, id);
		if(!notification) throw new Error(`Unknown notification id: ${id}`);
		if(notification.processed === true) return notification;
		await this.sendNotification(notification, global);
		notification.processed = true;
		return notification;
	},
	// @notTested
	async bulkNotificationProcess(global, agId) {
		const notificationsNotProcessed = await dal.notificationsNotProcessed(agId);
		let output = [];
		const agR = await group.getOneByEither('root', false);
		const cl = await client.getOneFull(agR, global.notifications.registeredClientId);
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
		if(!notification.destinationUri || !(notification.id || notification._id)) throw new Error('Requested notification does not seem to be valid');
		const payload = JSON.parse(JSON.stringify(notification));
		if(payload.processed) delete payload.processed;
		if(!global) {
			global = await plugins.getLatestPluginOptions();
		}
		if(!token){
			const ag = await group.getOneByEither('root', false);
			const cl = await client.getOneFull(ag, global.notifications.registeredClientId);
			token = await client.generateClientCredentialToken(ag, cl, `api:write group:${ag.id || ag._id}`, global.notifications.notificationServiceUri);
		}
		const options = {
			method: 'POST',
			headers: {
				'Authorization': `bearer ${token.data.access_token}`
			},
			data: payload,
			url: notification.destinationUri
		};
		const result = await axios(options);
		const output = await dal.markProcessed(notification.id || notification._id);
		ueEvents.emit(notification.authGroupId, 'ue.plugin.notification.sent', output);
		return result;
	},
	// @notTested
	async getNotifications(ag, q, user) {
		let organization;
		if (q.organization) {
			organization = q.organization;
			delete q.organization;
		}
		const query = await helper.parseOdataQuery(q);
		if(user) {
			query.query.createdBy = user;
		}
		if(organization) {
			query.query.organization = organization;
		}
		return dal.getNotifications(ag.id, query);
	},
	// @notTested
	async getNotification(ag, id, org = undefined) {
		return dal.getNotification(ag.id, id, org);
	},
	// @notTested
	async deleteNotification(ag, id, user, org = undefined) {
		return dal.deleteNotification(ag.id, id, user, org);
	},
	// @notTested
	async getMyNotifications(ag, me) {
		const q = {
			query: {
				recipientUserId: me
			}
		};
		return dal.getNotifications(ag.id, q);
	},
	// @notTested
	async getMyNotification(ag, me, id) {
		return dal.getMyNotification(ag, me, id);
	},
	// @notTested
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