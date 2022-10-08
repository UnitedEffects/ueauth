import jsonPatch from 'jsonpatch';
import Boom from '@hapi/boom';
import dal from './dal';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';
import access from '../accounts/access';
import client from '../oidc/client/access';
import Joi from 'joi';

export default {
	async writeCustomRole(data) {
		data.custom = true;
		data.core = false;
		data.permissions = [];
		const output = await dal.writeRole(data);
		ueEvents.emit(data.authGroup, 'ue.role.create', output);
		return output;
	},
	async writeRole(data) {
		data.custom = false;
		//limiting this as a function of root permissions in the controller
		//data.permissions = [];
		const output = await dal.writeRole(data);
		ueEvents.emit(data.authGroup, 'ue.role.create', output);
		return output;
	},

	/***
	 * Internal use only
	 * @param data
	 * @returns {Promise<*>}
	 */
	async writeRoleFull(data) {
		data.custom = false;
		const output = await dal.writeRole(data);
		ueEvents.emit(data.authGroup, 'ue.role.create', output);
		return output;
	},

	async getAllRoles(authGroupId, q) {
		let search;
		if(q.search) {
			search = q.search;
			delete q.search;
		}
		const query = await helper.parseOdataQuery(q);
		if(search) query.query.$text = { $search : search };
		return dal.getAllRoles(authGroupId, query);
	},

	async getAllRolesAcrossProductsByOrg(authGroupId, organization, q) {
		let search;
		if(q.search) {
			search = q.search;
			delete q.search;
		}
		const query = await helper.parseOdataQuery(q);
		if(search) query.query.$text = { $search : search };
		return dal.getAllRolesAcrossProductsByOrg(authGroupId, organization, query);
	},

	async getRoles(authGroupId, product, q) {
		let search;
		if(q.search) {
			search = q.search;
			delete q.search;
		}
		const query = await helper.parseOdataQuery(q);
		if(search) query.query.$text = { $search : search };
		return dal.getRoles(authGroupId, product, query);
	},

	async getOrganizationRoles(authGroupId, product, organization, q) {
		let search;
		if(q.search) {
			search = q.search;
			delete q.search;
		}
		const query = await helper.parseOdataQuery(q);
		if(search) query.query.$text = { $search : search };
		return dal.getOrganizationRoles(authGroupId, product, organization, query);
	},

	async getRole(authGroupId, product, id) {
		return dal.getRole(authGroupId, product, id);
	},

	async getRoleByOrgProdId(authGroupId, product, organization, id) {
		return dal.getRoleByOrgProdId(authGroupId, product, organization, id);
	},

	async deleteRoleByOrgProdId(authGroupId, product, organization, id) {
		const checkAccounts = await access.checkRoles(authGroupId, id);
		if(checkAccounts) {
			throw Boom.badRequest('There are users associated to this role. You must remove them before deleting it.', checkAccounts);
		}
		const checkClients = await client.checkRoles(authGroupId, id);
		if(checkClients) {
			throw Boom.badRequest('There are backend services associated to this role. You must remove them before deleting it.', checkClients);
		}
		const result = await dal.deleteRoleByOrgProdId(authGroupId, product, organization, id);
		ueEvents.emit(authGroupId, 'ue.role.destroy', result);
		return result;
	},

	async getRoleByOrganizationAndId(authGroupId, organization, id) {
		return dal.getRoleByOrganizationAndId(authGroupId, organization, id);
	},

	async deleteRole(authGroupId, product, id) {
		const checkAccounts = await access.checkRoles(authGroupId, id);
		if(checkAccounts) {
			throw Boom.badRequest('There are users associated to this role. You must remove them before deleting it.', checkAccounts);
		}
		const checkClients = await client.checkRoles(authGroupId, id);
		if(checkClients) {
			throw Boom.badRequest('There are backend services associated to this role. You must remove them before deleting it.', checkClients);
		}
		const result = await dal.deleteRole(authGroupId, product, id);
		ueEvents.emit(authGroupId, 'ue.role.destroy', result);
		return result;
	},

	async patchRole(authGroup, role, id, product, update, modifiedBy) {
		const patched = jsonPatch.apply_patch(role.toObject(), update);
		patched.modifiedBy = modifiedBy;
		let validate = false;
		if(JSON.stringify(role?.permissions) !== JSON.stringify(patched?.permissions)) validate = true;
		const result = await dal.patchRole(authGroup.id || authGroup._id, id, product, patched, validate);
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.role.edit', result);
		return result;
	},
	async patchOrganizationRole(authGroup, role, id, organization, product, update, modifiedBy) {
		const patched = jsonPatch.apply_patch(role.toObject(), update);
		patched.modifiedBy = modifiedBy;
		await standardPatchValidation(role, patched);
		const result = await dal.patchOrganizationRole(authGroup.id || authGroup._id, id, organization, product, patched);
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
	},
	async deleteAllCustomRoles(authGroupId, organization) {
		const result = await dal.deleteAllCustomRoles(authGroupId, organization);
		ueEvents.emit(authGroupId, 'ue.roles.destroy', result);
		return result;
	},
	async getPermissionsInRole(authGroup, product, role, q, organization = undefined) {
		let search;
		if(q.search) {
			search = q.search;
			delete q.search;
		}
		const query = await helper.parseOdataQuery(q);
		const matchRole = {
			authGroup,
			product,
			_id: role
		};
		return dal.getPermissionsInRole(matchRole, organization, query, search);
	},
	/**
	 * FOR INTERNAL USE ONLY
	 * @param agId
	 * @param query
	 * @param update
	 * @returns {Promise<*>}
	 */
	async updateCoreRole(agId, query, update) {
		const result = await dal.updateCoreRole(query, update);
		ueEvents.emit(agId, 'ue.roles.edit', result);
		return result;
	}
};

async function standardPatchValidation(original, patched) {
	const definition = {
		createdAt: Joi.any().valid(original.createdAt).required(),
		createdBy: Joi.string().valid(original.createdBy).required(),
		modifiedAt: Joi.any().required(),
		modifiedBy: Joi.string().required(),
		authGroup: Joi.string().valid(original.authGroup).required(),
		core: Joi.boolean().valid(original.core).required(),
		_id: Joi.string().valid(original._id).required(),
		custom: Joi.boolean().valid(original.custom).required(),
		product: Joi.string().valid(original.product).required(),
		productCodedId: Joi.string().valid(original.productCodedId).required(),
		codedId: Joi.string().valid(original.codedId).required()
	};
	if(original.core === true) {
		definition.name = Joi.string().valid(original.name).required();
	}
	if(original.custom === true) {
		definition.organizatin = Joi.string().valid(original.organizatin).required();
	}
	const roleSchema = Joi.object().keys(definition);
	const main = await roleSchema.validateAsync(patched, {
		allowUnknown: true
	});
	if(main.error) throw main.error;
}