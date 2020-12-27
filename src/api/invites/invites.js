import dal from './dal';
import iat from '../oidc/initialAccess/iat';
import helper from '../../helper';

export default {
	async createInvite(data, authGroup) {
		let accessToken;
		try {
			const invite = JSON.parse(JSON.stringify(data));
			invite.authGroup = authGroup.id;
			const days = invite.daysToExpire || 7;
			const meta = {
				auth_group: authGroup.id,
				sub: invite.sub,
				email: invite.email
			};
			accessToken = await iat.generateIAT(days*86400, ['auth_group'], authGroup, meta);
			invite.accessToken = accessToken.jti;
			invite.expiresAt = accessToken.exp*1000;
			invite.createdAt = accessToken.iat*1000;
			return dal.createInvite(invite);
		} catch (error) {
			if (accessToken) {
				await iat.deleteOne(accessToken.jti, authGroup.id);
			}
			throw error;
		}
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

	async getInviteByEmail(authGroupId, em) {
		const email = String(em).toLowerCase();
		return dal.getInviteByEmail(authGroupId, email);
	}
};