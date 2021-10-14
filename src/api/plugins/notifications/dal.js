import Notify from './model';

export default {
	async createNotification(data) {
		const notify = new Notify(data);
		return notify.save();
	},
	async markProcessed(id) {
		return Notify.findOneAndUpdate({ _id: id}, { processed: true }, { new: true });
	},
	async getOne(id) {
		return Notify.findOne({ _id: id });
	},
	async getNotifications(gId, query) {
		query.query.authGroupId = gId;
		return Notify.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getNotification(agId, id) {
		return Notify.findOne( { _id: id, authGroupId: agId });
	},
	async deleteNotification(agId, id, user) {
		const query = (user) ? { _id: id, authGroupId: agId, createdBy: user } : { _id: id, authGroupId: agId };
		return Notify.findOneAndRemove(query);
	},
	async notificationsNotProcessed(agId) {
		return Notify.find({ authGroupId: agId, processed: false }).limit(25);
	}
};