import jsonPatch from 'jsonpatch';
import dal from './dal';
import access from '../accounts/access';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';
import Boom from "@hapi/boom";
import account from "../accounts/account";

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

	async patchDomain(authGroup, orgId, id, update, modifiedBy) {
		const dom = await dal.getDomain(authGroup.id || authGroup._id, orgId, id);
		const patched = jsonPatch.apply_patch(dom.toObject(), update);
		patched.modifiedBy = modifiedBy;
		const result = await dal.patchDomain(authGroup.id || authGroup._id, orgId, id, patched);
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.domain.edit', result);
		return result;
	},

	async checkProducts(authGroup, organization, id) {
		const result = await dal.checkProducts(authGroup, organization, id);
		if(result.length === 0) return false;
		return result;
	}
};