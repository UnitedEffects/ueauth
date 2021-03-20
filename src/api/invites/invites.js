import dal from './dal';
import iat from '../oidc/initialAccess/iat';
import helper from '../../helper';
import plugin from '../../notifications';

const config = require('../../config');

export default {
	async createInvite(userId, data, authGroup) {
		let accessToken;
		let invResult;
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
			invResult = await dal.createInvite(invite);
			// todo make invite screen
			await plugin.notify(userId, authGroup, 'invite',
				{
					id: meta.sub,
					email: meta.email
				},  {
					screen: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.prettyName}/invite/${invResult.id}`
				}, {
					message: 'You have been invited',
					subject: 'Invite',
					meta: invResult
				});
			return invResult;
		} catch (error) {
			if (accessToken) {
				await iat.deleteOne(accessToken.jti, authGroup.id);
			}
			if (invResult) {
				await dal.deleteInvite(authGroup, invResult.id);
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

	async inviteAuthorizedLookup(authGroupId, sub, type) {
		return dal.inviteAuthorizedLookup(authGroupId, sub, type);
	}
};