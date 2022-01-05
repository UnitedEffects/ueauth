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
	async getNotification(authGroupId, _id, organization) {
		const q = {
			_id,
			authGroupId
		};
		if(organization) {
			q.organization = organization;
		}
		return Notify.findOne(q);
	},
	async getMyNotification(authGroupId, recipientUserId, _id) {
		return Notify.findOne( { _id, authGroupId, recipientUserId });
	},
	async deleteNotification(agId, id, user, organization = undefined) {
		const query = (user) ? { _id: id, authGroupId: agId, createdBy: user } : { _id: id, authGroupId: agId };
		if(organization) {
			query.organization = organization;
		}
		return Notify.findOneAndRemove(query);
	},
	async notificationsNotProcessed(agId) {
		return Notify.find({ authGroupId: agId, processed: false }).limit(25);
	}
};