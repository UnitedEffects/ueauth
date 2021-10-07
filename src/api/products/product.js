import jsonPatch from 'jsonpatch';
import Boom from '@hapi/boom';
import dal from './dal';
import org from '../orgs/orgs';
import role from '../roles/roles';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';

const config = require('../../config');

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

	async getProduct(authGroupId, id) {
		return dal.getProduct(authGroupId, id);
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
		const result = await dal.patchProduct(authGroup.id || authGroup._id, id, patched);
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.product.edit', result);
		return result;
	},
	async getCoreProduct(authGroup) {
		const query = {
			name: `${authGroup.name} - ${config.PLATFORM_NAME}`,
			authGroup: authGroup.id,
			type: 'global',
			core: true
		};
		return dal.getCoreProduct(query);
	},
	async updateCoreMetaData(authGroup, id, meta) {
		const result = dal.updateCoreMetaData(authGroup, id, meta);
		ueEvents.emit(authGroup, 'ue.product.edit', result);
		return result;
	}
};