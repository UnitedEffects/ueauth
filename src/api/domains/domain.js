import jsonPatch from 'jsonpatch';
import dal from './dal';
import access from '../accounts/access';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';
import Boom from '@hapi/boom';
import Joi from 'joi';

export default {
	async writeDomain(data) {
		const output = await dal.writeDomain(data);
		ueEvents.emit(data.authGroup, 'ue.domain.create', output);
		return output;
	},

	async getDomains(authGroupId, orgId, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getDomains(authGroupId, orgId, query);
	},

	async getDomain(authGroupId, org, id) {
		return dal.getDomain(authGroupId, org, id);
	},

	async deleteDomain(authGroupId, orgId, id) {
		const checkAccounts = await access.checkDomains(authGroupId, orgId, id);
		if(checkAccounts) {
			throw Boom.badRequest('You have users associated to this organization domain. You must remove them before deleting it.', checkAccounts);
		}
		const result = await dal.deleteDomain(authGroupId, orgId, id);
		ueEvents.emit(authGroupId, 'ue.domain.destroy', result);
		return result;
	},

	async patchDomain(authGroup, dom, orgId, id, update, modifiedBy, core = undefined) {
		const patched = jsonPatch.apply_patch(dom.toObject(), update);
		patched.modifiedBy = modifiedBy;
		const originalProducts = [...new Set(dom.associatedOrgProducts)];
		const updatedProducts = [...new Set(patched.associatedOrgProducts)];
		let coreProdRemoved = false;
		if(updatedProducts.length < originalProducts.length) {
			const diff = originalProducts.filter(x => !updatedProducts.includes(x));
			for(let i=0; i<diff.length; i++) {
				if(originalProducts.includes(diff[i]) && !updatedProducts.includes(diff[i]) && core?.products?.includes(diff[i])) {
					coreProdRemoved = true;
				}
			}
		}
		if(coreProdRemoved === true) {
			throw Boom.forbidden('You cannot remove core products as this would impact access. If you feel you need to carry out this action, contact the administrator');
		}
		await standardPatchValidation(dom, patched);
		const result = await dal.patchDomain(authGroup.id || authGroup._id, orgId, id, patched);
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.domain.edit', result);
		return result;
	},

	async checkProducts(authGroup, organization, id) {
		const result = await dal.checkProducts(authGroup, organization, id);
		if(result.length === 0) return false;
		return result;
	},

	async updateAdminDomainAssociatedProducts(authGroup, organization) {
		const result = await dal.updateAdminDomainAssociatedProducts(authGroup, organization);
		ueEvents.emit(authGroup, 'ue.domain.edit', result);
		return result;
	},
	async getOrgAdminDomain(authGroup, orgId) {
		return dal.getOrgAdminDomain(authGroup, orgId);
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
		organization: Joi.string().valid(original.organization).required(),
	};
	if(original.core === true) {
		definition.name = Joi.string().valid(original.name).required();
	}
	const metaSchema = Joi.object().keys({
		admin: Joi.string().valid(original.meta.admin).required()
	});
	const domSchema = Joi.object().keys(definition);
	const main = await domSchema.validateAsync(patched, {
		allowUnknown: true
	});
	if(main.error) throw main.error;
	const meta = await metaSchema.validateAsync(patched.meta, {
		allowUnknown: true
	});
	if(meta.error) throw meta.error;
}