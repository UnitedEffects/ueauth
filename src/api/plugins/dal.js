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
	async getLatestPlugins() {
		return Plugins.findOne({}, {}, {sort: { 'createdAt': -1, 'version': -1 }});
	},
	async auditPluginOptions() {
		return Plugins.find({}, {}, {sort: { 'createdAt': -1, 'version': -1 }});
	},
	async toggleNotifications(version, data, userId) {
		//const check = await Plugins.findOne({}, {}, {sort: {'createdAt': -1}});
		let plugin;
		plugin = new Plugins({
			// todo - as new configs are added, we can preserve them here
			createdBy: userId,
			version,
			notifications: data
		});

		return plugin.save();
	}
};