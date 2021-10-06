import jsonPatch from 'jsonpatch';
import Boom from '@hapi/boom';
import dal from './dal';
import dom from '../domains/domain';
import access from '../accounts/access';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';

export default {
	async writeOrg(agId, data) {
		data.authGroup = agId;
		const output = await dal.writeOrg(data);
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

	async deleteOrg(authGroupId, id) {
		const checkAccounts = await access.checkOrganizations(authGroupId, id);
		if(checkAccounts) {
			throw Boom.badRequest('You have users associated to this organization. You must remove them before deleting it.', checkAccounts);
		}
		const result = await dal.deleteOrg(authGroupId, id);
		ueEvents.emit(authGroupId, 'ue.organization.destroy', result);
		return result;
	},

	async patchOrg(authGroup, org, id, update, modifiedBy) {
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
		const result = await dal.patchOrg(authGroup.id || authGroup._id, id, patched);
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.organization.edit', result);
		return result;
	},

	async checkProduct(authGroup, productId) {
		const result = await dal.checkProduct(authGroup, productId);
		if(result.length === 0) return false;
		return result;
	}
};