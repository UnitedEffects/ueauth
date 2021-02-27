import dal from './dal';
//import helper from '../../helper';
//const config = require('../../config');

export default {
	async toggleNotifications(data, userId) {
		const saved = await dal.toggleNotifications(data, userId);
		return {
			enabled: saved.notifications.enabled || false,
			notificationServiceClientId: saved.notifications.registeredClientId || undefined,
			notificationServiceClientName: saved.notifications.registeredClientName || undefined
		};
	},
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