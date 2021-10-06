import jsonPatch from 'jsonpatch';
import Boom from '@hapi/boom';
import dal from './dal';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';
import access from '../accounts/access';

export default {
	async writeCustomRole(data) {
		data.custom = true;
		data.permissions = [];
		const output = await dal.writeRole(data);
		ueEvents.emit(data.authGroup, 'ue.role.create', output);
		return output;
	},
	async writeRole(data) {
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

	async getAllRolesAcrossProductsByOrg(authGroupId, organization, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getAllRolesAcrossProductsByOrg(authGroupId, organization, query);
	},

	async getRoles(authGroupId, product, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getRoles(authGroupId, product, query);
	},

	async getOrganizationRoles(authGroupId, product, organization, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getOrganizationRoles(authGroupId, product, organization, query);
	},

	async getRole(authGroupId, product, id) {
		return dal.getRole(authGroupId, product, id);
	},

	async getRoleByOrganizationAndId(authGroupId, organization, id) {
		return dal.getRoleByOrganizationAndId(authGroupId, organization, id);
	},

	async deleteRole(authGroupId, product, id) {
		const checkAccounts = await access.checkRoles(authGroupId, id);
		if(checkAccounts) {
			throw Boom.badRequest('There are users associated to this role. You must remove them before deleting it.', checkAccounts);
		}
		const result = await dal.deleteRole(authGroupId, product, id);
		ueEvents.emit(authGroupId, 'ue.role.destroy', result);
		return result;
	},

	async patchRole(authGroup, role, id, product, update, modifiedBy) {
		const patched = jsonPatch.apply_patch(role.toObject(), update);
		patched.modifiedBy = modifiedBy;
		const result = await dal.patchRole(authGroup.id || authGroup._id, id, product, patched);
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.role.edit', result);
		return result;
	},
	async checkProduct(authGroup, productId) {
		const result = await dal.checkProduct(authGroup, productId);
		if(result.length === 0) return false;
		return result;
	},
	async clearPermission(authGroup, product, coded) {
		const result = await dal.clearPermissionFromRoles(authGroup, product, coded);
		return result.nModified;
	},
	async checkForPermissions(authGroup, product, coded) {
		const result = await dal.checkForPermissions(authGroup, product, coded);
		return {
			totalReferences: result.length,
			roleIds: result
		};
	},
	async bulkWrite(authGroupId, roles) {
		const result = await dal.bulkWrite(roles);
		ueEvents.emit(authGroupId, 'ue.roles.create', result);
		return result;
	},
	async deleteRolesOfProduct(authGroupId, product) {
		const result = await dal.deleteRolesOfProduct(authGroupId, product);
		ueEvents.emit(authGroupId, 'ue.roles.destroy', result);
		return result;
	}
};