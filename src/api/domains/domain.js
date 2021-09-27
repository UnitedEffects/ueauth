import jsonPatch from 'jsonpatch';
import dal from './dal';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';

export default {
	async writeDomain(data) {
		const output = await dal.writeDomain(data);
		ueEvents.emit(data.authGroup, 'ue.domain.create', output);
		return output;
	},

	// @notTested - filters not tested, general query is
	async getDomains(authGroupId, orgId, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getDomains(authGroupId, orgId, query);
	},

	async getDomain(authGroupId, org, id) {
		return dal.getDomain(authGroupId, org, id);
	},

	// @notTested
	async deleteDomain(authGroupId, orgId, id) {
		const result = await dal.deleteDomain(authGroupId, orgId, id);
		ueEvents.emit(authGroupId, 'ue.domain.destroy', result);
	},

	async patchDomain(authGroup, orgId, id, update, modifiedBy) {
		const dom = await dal.getDomain(authGroup.id || authGroup._id, orgId, id);
		const patched = jsonPatch.apply_patch(dom.toObject(), update);
		patched.modifiedBy = modifiedBy;
		const result = await dal.patchDomain(authGroup.id || authGroup._id, orgId, id, patched);
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.domain.edit', result);
		return result;
	}
};