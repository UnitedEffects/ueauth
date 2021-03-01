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
		const saved = await dal.toggleNotifications(data, userId);
		return {
			notifications: {
				enabled: saved.notifications.enabled || false,
				notificationServiceUri: saved.notifications.notificationServiceUri || undefined,
				notificationServiceClientId: saved.notifications.registeredClientId || undefined,
				notificationServiceClientSecret: (client) ? client.client_secret : undefined
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