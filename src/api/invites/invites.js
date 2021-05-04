import dal from './dal';
import helper from '../../helper';
//import plugin from '../../notifications';
//const config = require('../../config');

export default {
	async createInvite(userId, data, authGroup) {
		const invite = JSON.parse(JSON.stringify(data));
		invite.authGroup = authGroup.id;
		const days = invite.daysToExpire || 7;
		invite.expiresAt = new Date().setDate(new Date().getDate() + days);
		// todo validate resource Ids with a function here...
		const invResult = await dal.createInvite(invite);
		// todo notification
		return invResult;
	},

	async getInvites(authGroupId, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getInvites(authGroupId, query);
	},

	async getInvite(authGroupId, id) {
		return dal.getInvite(authGroupId, id);
	},

	async deleteInvite(authGroupId, id) {
		return dal.deleteInvite(authGroupId, id);
	},

	async inviteAuthorizedLookup(authGroupId, sub, type) {
		return dal.inviteAuthorizedLookup(authGroupId, sub, type);
	}
};