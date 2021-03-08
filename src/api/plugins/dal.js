import Plugins from './model';
const config = require('../../config');

export default {
	async initPlugins() {
		const plugin = new Plugins({
			createdBy: config.ROOT_EMAIL,
			notifications: {
				enabled: false
			}
		});
		return plugin.save();
	},
	async getLatestPlugins() {
		return Plugins.findOne({}, {}, {sort: {'createdAt': -1}});
	},
	async auditPluginOptions() {
		return Plugins.find({}, {}, {sort: {'createdAt': -1}});
	},
	async toggleNotifications(data, userId) {
		//const check = await Plugins.findOne({}, {}, {sort: {'createdAt': -1}});
		let plugin;
		plugin = new Plugins({
			// todo - as new configs are added, we can preserve them here
			createdBy: userId,
			notifications: data
		});

		return plugin.save();
	},
/*
	async getLogs(query) {
		return Plugins.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getLog(id) {
		return Plugins.findOne( { _id: id });
	}

 */
};