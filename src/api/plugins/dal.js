import Plugins from './model';

export default {
	async toggleNotifications(data, userId) {
		const check = await Plugins.findOne({}, {}, {sort: {'createdAt': -1}});
		let plugin;
		if(check.length === 0) {
			// todo create new registered client with name = NOTIFICATION SERVICE (CLIENTID) (DATE)
			data.registeredClientId = 'fixthislater'; //todo
			data.registeredClientName = 'fixthislatertoo';
			plugin = new Plugins({
				createdBy: userId,
				notifications: data
			});
		}
		if (check[0].notifications.registeredClient) {
			// todo attempt to delete
		}
		if (data.enabled === true){
			// todo create new registered client with name = NOTIFICATION SERVICE (CLIENTID) (DATE)
			data.registeredClientId = 'fixthislater'; //todo
			data.registeredClientName = 'fixthislatertoo';
		}
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