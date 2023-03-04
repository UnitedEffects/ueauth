import Plugins from './model';
const config = require('../../config');

export default {
	async initPlugins() {
		const plugin = new Plugins({
			createdBy: config.ROOT_EMAIL,
			version: 1,
			notifications: {
				enabled: false
			}
		});
		return plugin.save();
	},
	async getLatestPlugins(sort) {
		return Plugins.findOne({}, {}, { sort });
	},
	async auditPluginOptions() {
		//return Plugins.find({}, {}, {sort: { 'createdAt': -1, 'version': -1 }});
		return Plugins.find({}, {}, {sort: { 'version': -1 }});
	},
	async updatePlugins(version, record, userId) {
		let plugin;
		plugin = new Plugins({
			createdBy: userId,
			version,
			notifications: record?.notifications,
			mfaChallenge: record?.mfaChallenge,
			webAuthN: record?.webAuthN,
			eventStream: record?.eventStream,
			resourceCreationLimiter: record?.resourceCreationLimiter
		});

		return plugin.save();
	},
	/**
	 * DEPRECATING
	 * @param version
	 * @param data
	 * @param userId
	 * @returns {Promise<Document<any, any, any>>}
	 async toggleNotifications(version, data, userId) {
		let plugin;
		plugin = new Plugins({
			// As new configs are added, we can preserve them here
			createdBy: userId,
			version,
			notifications: data
		});

		return plugin.save();
	},
	 */
};