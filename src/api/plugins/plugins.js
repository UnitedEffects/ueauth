import Boom from '@hapi/boom';
import dal from './dal';
import group from '../authGroup/group';
import cl from '../oidc/client/clients';

//import helper from '../../helper';
//const config = require('../../config');

export default {
	async initPlugins() {
		return dal.initPlugins();
	},
	async toggleGlobalNotifications(data, userId) {
		const root = await group.getOneByEither('root');
		let client;
		if(data.enabled === true) {
			client = await cl.generateNotificationServiceClient(root);
			data.registeredClientId = client.client_id;
		}
		if(data.enabled === false) {
			await cl.deleteNotificationsServiceClient(root);
		}
		const lastSaved = await dal.getLatestPlugins();
		if(data.currentVersion !== lastSaved.version) {
			throw Boom.badRequest('Must provide the current version to be incremented. If you thought you did, someone may have updated this before you.');
		}
		const saved = await dal.toggleNotifications(lastSaved.version+1, data, userId);
		return {
			notifications: {
				enabled: saved.notifications.enabled || false,
				notificationServiceUri: saved.notifications.notificationServiceUri || undefined,
				notificationServiceClientId: saved.notifications.registeredClientId || undefined,
				notificationServiceClientSecret: (client) ? client.client_secret : undefined,
				plugins: {
					version: lastSaved.version+1,
				}
			}
		};
	},
	async getLatestPluginOptions() {
		return dal.getLatestPlugins();
	},
	async auditPluginOptions() {
		return dal.auditPluginOptions();
	}
/*
    async getLogs(q) {
        const query = await helper.parseOdataQuery(q);
        return dal.getLogs(query);
    },

    async getLog(id) {
        return dal.getLog(id);
    },

    async record(data, write=WRITE_BEHAVIOR) {
        const logData = {
            logCode: 'HTTP',
            message: 'Error recorded and sent out as http response.',
            details: data
        };
        return this.writeLog(logData, write);
    },

 */
};