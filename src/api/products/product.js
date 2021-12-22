import jsonPatch from 'jsonpatch';
import Boom from '@hapi/boom';
import dal from './dal';
import org from '../orgs/orgs';
import role from '../roles/roles';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';
import Joi from 'joi';

export default {
	async writeProduct(data) {
		const output = await dal.writeProduct(data);
		ueEvents.emit(data.authGroup, 'ue.product.create', output);
		return output;
	},

	// @notTested - filters not tested, general query is
	async getProducts(authGroupId, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getProducts(authGroupId, query);
	},

	// @notTested
	async getTheseProducts(authGroupId, prodArray) {
		return dal.getTheseProducts(authGroupId, prodArray);
	},

	async getProduct(authGroupId, id) {
		return dal.getProduct(authGroupId, id);
	},

	// @notTested
	async getOrgProduct(authGroupId, id) {
		return dal.getOrgProduct(authGroupId, id);
	},

	// @notTested
	async deleteProduct(authGroupId, id) {
		const checkOrgs = await org.checkProduct(authGroupId, id);
		if(checkOrgs) {
			throw Boom.badRequest('You must remove this product from the following organizations before deleting', checkOrgs);
		}
		const checkRoles = await role.checkProduct(authGroupId, id);
		if(checkRoles) {
			throw Boom.badRequest('This product has associated roles which may be attributed to users. Clean them up before deleting.', checkRoles);
		}
		const result = await dal.deleteProduct(authGroupId, id);
		ueEvents.emit(authGroupId, 'ue.product.destroy', result);
		return result;
	},

	async patchProduct(authGroup, product, id, update, modifiedBy) {
		const patched = jsonPatch.apply_patch(product.toObject(), update);
		patched.modifiedBy = modifiedBy;
		await standardPatchValidation(product, patched);
		const result = await dal.patchProduct(authGroup.id || authGroup._id, id, patched);
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.product.edit', result);
		return result;
	},
	async getCoreProduct(authGroup, coreType) {
		const query = {
			authGroup: authGroup,
			type: 'global',
			'meta.core': coreType,
			core: true
		};
		return dal.getCoreProduct(query);
	},
	async getCoreProducts(authGroup, name) {
		const query = {
			$or: [
				{ 'meta.core': 'groupAdmin'},
				{ 'meta.core': 'orgAdmin'}
			],
			authGroup: authGroup.id,
			type: 'global',
			core: true
		};
		if(name) query.name = name;
		return dal.getCoreProducts(query);
	},
	async updateCoreMetaData(authGroup, id, meta) {
		const result = await dal.updateCoreMetaData(authGroup, id, meta);
		ueEvents.emit(authGroup, 'ue.product.edit', result);
		return result;
	},
	async addAssociatedClient(authGroup, id, clientId) {
		const result = await dal.addAssociatedClient(authGroup, id, clientId);
		if(!result) throw Boom.notFound(id);
		ueEvents.emit(authGroup, 'ue.product.edit', result);
		return result;
	},
	async removeAssociatedClient(authGroup, id, clientId) {
		const result = await dal.removeAssociatedClient(authGroup, id, clientId);
		if(!result) throw Boom.notFound(id);
		ueEvents.emit(authGroup, 'ue.product.edit', result);
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
		codedId: Joi.string().valid(original.codedId).required()
	};
	if(original.core === true) {
		definition.name = Joi.string().valid(original.name).required();
	}
	const metaSchema = Joi.object().keys({
		core: Joi.string().valid(original.meta.core).required()
	});
	const prodSchema = Joi.object().keys(definition);
	const main = await prodSchema.validateAsync(patched, {
		allowUnknown: true
	});
	if(main.error) throw main.error;
	const meta = await metaSchema.validateAsync(patched.meta, {
		allowUnknown: true
	});
	if(meta.error) throw meta.error;
}