import jsonPatch from 'jsonpatch';
import Boom from '@hapi/boom';
import dal from './dal';
import org from '../orgs/orgs';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';

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
		const result = await dal.deleteProduct(authGroupId, id);
		ueEvents.emit(authGroupId, 'ue.product.destroy', result);
		return result;
	},

	async patchProduct(authGroup, id, update, modifiedBy) {
		const dom = await dal.getProduct(authGroup.id || authGroup._id, id);
		const patched = jsonPatch.apply_patch(dom.toObject(), update);
		patched.modifiedBy = modifiedBy;
		const result = await dal.patchProduct(authGroup.id || authGroup._id, id, patched);
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.product.edit', result);
		return result;
	}
};