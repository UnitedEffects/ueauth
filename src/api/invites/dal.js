import Invite from './model';

export default {
	async createInvite(data) {
		const ogPassCode = data.passCode;
		const ogAccessToken = data.accessToken;
		const invite =  new Invite(data);
		const result = JSON.parse(JSON.stringify(await invite.save()));
		result.passCode = ogPassCode;
		result.accessToken = ogAccessToken;
		return result;
	},
	async getInvites(g, query) {
		query.query.authGroup = g;
		return Invite.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getInvite(authGroup, id) {
		return Invite.findOne( { _id: id, authGroup });
	},
	async deleteInvite(authGroup, id) {
		return Invite.findOneAndRemove( { _id: id, authGroup });
	},
	async inviteAuthorizedLookup(authGroup, sub, type) {
		return Invite.findOne({sub, authGroup, type});
	}
};