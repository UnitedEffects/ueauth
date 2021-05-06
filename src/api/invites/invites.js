import dal from './dal';
import helper from '../../helper';
import group from '../authGroup/group';
import Boom from '@hapi/boom';
//import plugin from '../../notifications';
//const config = require('../../config');

const inv = {
	async createInvite(userId, data, authGroup) {
		const invite = JSON.parse(JSON.stringify(data));
		invite.authGroup = authGroup.id;
		const days = invite.daysToExpire || 7;
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
		const invResult = await dal.createInvite(invite);
		// todo notification
		return invResult;
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
	}
};

export default inv;