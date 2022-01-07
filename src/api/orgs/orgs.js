import jsonPatch from 'jsonpatch';
import Boom from '@hapi/boom';
import dal from './dal';
import dom from '../domains/domain';
import prod from '../products/product';
import access from '../accounts/access';
import profile from '../profiles/profiles';
import role from '../roles/roles';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';
import Joi from 'joi';

const config = require('../../config');

export default {
	async writeOrg(agId, data, aliasDns = undefined) {
		data.authGroup = agId;
		const product = await prod.getCoreProduct(agId, 'orgAdmin');
		if(!data.associatedProducts) data.associatedProducts = [];
		data.associatedProducts.push(product._id);
		if(data.sso) {
			if(Object.keys(data.sso).length > 1) throw Boom.badRequest('You can only define a single SSO connection per org');
		}
		const output = await dal.writeOrg(data);
		if(output.sso && output.sso.oidc) {
			const connect = output.sso.oidc;
			output.sso.redirectUris = [];
			output.sso.redirectUris.push(`${config.PROTOCOL}://${config.SWAGGER}/${data.authGroup}/interaction/callback/oidc/org:${output._id}/${connect.name.replace(/ /g, '_').toLowerCase()}`);
			if(output.externalId) {
				output.sso.redirectUris.push(`${config.PROTOCOL}://${config.SWAGGER}/${data.authGroup}/interaction/callback/oidc/org:${output.externalId}/${connect.name.replace(/ /g, '_').toLowerCase()}`);
			}
			if(aliasDns) {
				output.sso.redirectUris.push(`${config.PROTOCOL}://${aliasDns}/${data.authGroup}/interaction/callback/oidc/org:${output._id}/${connect.name.replace(/ /g, '_').toLowerCase()}`);
				if(output.externalId) {
					output.sso.redirectUris.push(`${config.PROTOCOL}://${aliasDns}/${data.authGroup}/interaction/callback/oidc/org:${output.externalId}/${connect.name.replace(/ /g, '_').toLowerCase()}`);
				}
			}
		}
		ueEvents.emit(data.authGroup, 'ue.organization.create', output);
		return output;
	},

	async getOrgs(authGroupId, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getOrgs(authGroupId, query);
	},

	async getOrg(authGroupId, id) {
		return dal.getOrg(authGroupId, id);
	},

	async getTheseOrgs(authGroupId, idArray) {
		return dal.getTheseOrgs(authGroupId, idArray);
	},

	async getPrimaryOrg(authGroupId) {
		return dal.getPrimaryOrg(authGroupId);
	},

	async deleteOrg(authGroupId, id) {
		const checkAccounts = await access.checkOrganizations(authGroupId, id);
		if(checkAccounts) {
			throw Boom.badRequest('You have users associated to this organization. You must remove them before deleting it.', checkAccounts);
		}
		// attempt to delete org profiles
		await profile.deleteAllOrgProfiles(authGroupId, id);
		// attempt to delete org roles
		await role.deleteAllCustomRoles(authGroupId, id);
		// delete the org
		const result = await dal.deleteOrg(authGroupId, id);
		ueEvents.emit(authGroupId, 'ue.organization.destroy', result);
		return result;
	},

	async patchOrg(authGroup, org, id, update, modifiedBy, limited = true) {
		const patched = jsonPatch.apply_patch(org.toObject(), update);
		const originalProducts = [...new Set(org.associatedProducts)];
		const updatedProducts = [...new Set(patched.associatedProducts)];
		let domains = [];
		if(updatedProducts.length < originalProducts.length) {
			const diff = originalProducts.filter(x => !updatedProducts.includes(x));
			for(let i=0; i<diff.length; i++) {
				const temp = await dom.checkProducts(authGroup, id, diff[i]);
				if(temp.length !== 0) {
					domains.push({
						productId: diff[i],
						domainReferences: temp
					});
				}
			}
		}
		if(domains.length !== 0) {
			throw Boom.badRequest('You are attempting to remove a product from this organization that is referenced in domains. Remove from the domains first', domains);
		}
		patched.modifiedBy = modifiedBy;

		if(limited === true) {
			await restrictedPatchValidation(org, patched);
		} else await standardPatchValidation(org, patched);
		const result = await dal.patchOrg(authGroup.id || authGroup._id, id, patched);
		try {
			await dom.updateAdminDomainAssociatedProducts(authGroup.id || authGroup._id, patched);
		} catch (e) {
			ueEvents.emit(authGroup.id, 'ue.organization.error', e);
		}
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.organization.edit', result);
		return result;
	},

	async checkProduct(authGroup, productId) {
		const result = await dal.checkProduct(authGroup, productId);
		if(result.length === 0) return false;
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
		_id: Joi.string().valid(original._id).required()
	};
	if(original.core === true) {
		definition.name = Joi.string().valid(original.name).required();
	}
	if(patched.sso) {
		if(Object.keys(patched.sso).length > 1) throw Boom.badRequest('You can only define a single SSO connection per org');
	}
	const orgSchema = Joi.object().keys(definition);
	const result = await orgSchema.validateAsync(patched, {
		allowUnknown: true
	});
	if(result.error) throw result.error;
}

async function restrictedPatchValidation(o, p) {
	const original = JSON.parse(JSON.stringify(o));
	const patched = JSON.parse(JSON.stringify(p));
	if(original.associatedProducts) {
		original.associatedProducts = original.associatedProducts.join(' ');
	}
	if(patched.associatedProducts) {
		patched.associatedProducts = patched.associatedProducts.join(' ');
	}
	const definition = {
		createdAt: Joi.any().valid(original.createdAt).required(),
		createdBy: Joi.string().valid(original.createdBy).required(),
		modifiedAt: Joi.any().required(),
		modifiedBy: Joi.string().required(),
		authGroup: Joi.string().valid(original.authGroup).required(),
		core: Joi.boolean().valid(original.core).required(),
		_id: Joi.string().valid(original._id || original.id).required(),
		associatedProducts: Joi.string().valid(original.associatedProducts).required(),
		type: Joi.string().valid(original.type).required()
	};
	if(original.core === true) {
		definition.name = Joi.string().valid(original.name).required();
	}
	if(patched.sso) {
		if(Object.keys(patched.sso).length > 1) throw Boom.badRequest('You can only define a single SSO connection per org');
	}
	const orgSchema = Joi.object().keys(definition);
	const result = await orgSchema.validateAsync(patched, {
		allowUnknown: true
	});
	if(result.error) throw result.error;
}