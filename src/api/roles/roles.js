import jsonPatch from 'jsonpatch';
import Boom from '@hapi/boom';
import dal from './dal';
import dom from '../domains/domain';
import account from '../accounts/account';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';

export default {
	async writeCustomRole(agId, data) {
		data.custom = true;
		data.permissions = [];
		const output = await dal.writeRole(data);
		ueEvents.emit(data.authGroup, 'ue.role.create', output);
		return output;
	},
	async writeRole(agId, data) {
		data.custom = false;
		data.permissions = [];
		const output = await dal.writeRole(data);
		ueEvents.emit(data.authGroup, 'ue.role.create', output);
		return output;
	},

	async getAllRoles(authGroupId, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getAllRoles(authGroupId, query);
	},

	async getRoles(authGroupId, product, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getRoles(authGroupId, product, query);
	},

	async getOrganizationRoles(authGroupId, product, organization, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getRoles(authGroupId, product, organization, query);
	},

	async getRole(authGroupId, product, id) {
		return dal.getRole(authGroupId, product, id);
	},

	async deleteRole(authGroupId, product, id) {
		/** will need this...
		const checkAccounts = await account.checkOrganizations(authGroupId, id);
		if(checkAccounts) {
			throw Boom.badRequest('You have users associated to this organization. You must remove them before deleting it.', checkAccounts);
		}
		 */
		const result = await dal.deleteRole(authGroupId, product, id);
		ueEvents.emit(authGroupId, 'ue.role.destroy', result);
	},

	async patchRole(authGroup, id, product, update, modifiedBy) {
		const role = await dal.getRole(authGroup.id || authGroup._id, id);
		const patched = jsonPatch.apply_patch(role.toObject(), update);
		patched.modifiedBy = modifiedBy;
		const result = await dal.patchRole(authGroup.id || authGroup._id, id, product, patched);
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.role.edit', result);
		return result;
	}
};