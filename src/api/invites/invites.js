import dal from './dal';
import helper from '../../helper';
import group from '../authGroup/group';
import Boom from '@hapi/boom';

const config = require('../../config');

const inv = {
	async createInvite(userId, data, authGroup) {
		const invite = JSON.parse(JSON.stringify(data));
		invite.authGroup = authGroup.id;
		const days = (invite.daysToExpire || invite.daysToExpire === 0) ? invite.daysToExpire : 7;
		invite.expiresAt = new Date().setDate(new Date().getDate() + days);
		const valEr = [];
		await Promise.all(invite.resources.map(async (resource) => {
			try {
				if(resource) await inv.validateResourceIds(resource.resourceType, resource.resourceId);
			} catch (error) {
				valEr.push(error);
			}
		}))
		if(valEr.length!==0) throw Boom.badRequest(valEr.join('; '));
		return dal.createInvite(invite);
	},
	async incSent(authGroupId, id) {
		const update = {
			status: 'sent',
			$inc : { xSent : 1 }
		}
		return dal.updateSent(authGroupId, id, update);
	},
	inviteNotificationObject(authGroup, user, invite, formats = [], activeUser) {
		const options = { year: "numeric", month: "long", day: "numeric" };
		const data = {
			iss: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}`,
			createdBy: activeUser,
			type: 'invite',
			formats,
			recipientUserId: user.id,
			recipientEmail: user.email,
			recipientSms: user.sms,
			screenUrl: `${config.PROTOCOL}://${config.UI_URL}`,
			subject: (invite.type === 'owner') ? `${authGroup.name} - Invite to Take Ownership of Resource` : `${authGroup.name} - Invite to Access Resource`,
			message: `You have an invitation to ${(invite.type==='owner') ? 'take ownership of' : 'access'} resources within the ${authGroup.name} authentication group. This invite expires at ${new Date(invite.expiresAt).toLocaleDateString(undefined, options)}. Please go to the invitation dashboard to take action.`,
			meta: {
				description: 'Direct API calls. You must have an active session token to make invite API calls. Token not provided by invite.',
				resources: invite.resources,
				expiresAt: invite.expiresAt,
				apiUri: `${config.PROTOCOL}://${config.SWAGGER}/api/${authGroup.id}/operation/invite/${invite.id}`,
				apiMethod: 'POST',
				apiBody: { operation: 'accept' }
			}
		};

		if(formats.length === 0) {
			data.formats = [];
			if(user.email) data.formats.push('email');
			if(user.sms) data.formats.push('sms');
		}
		return data;
	},
	async validateResourceIds(r, id) {
		switch (r) {
			case 'group':
				const ag = await group.getOne(id);
				if(!ag) throw `Resource id ${id} does not exist`;
				return;
			default:
				throw `Resource type ${r} does not exist or has not been implemented yet`;
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
	},

	async updateInviteStatus(authGroupId, id, status) {
		return dal.updateStatus(authGroupId, id, status);
	}
};

export default inv;