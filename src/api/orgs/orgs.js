import jsonPatch from 'jsonpatch';
import dal from './dal';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';

export default {
	async writeOrg(agId, data) {
		data.authGroup = agId;
		const output = await dal.writeOrg(data);
		ueEvents.emit(data.authGroup, 'ue.organization.create', output);
		return output;
	},

	// @notTested - filters not tested, general query is
	async getOrgs(authGroupId, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getOrgs(authGroupId, query);
	},

	async getOrg(authGroupId, id) {
		return dal.getOrg(authGroupId, id);
	},

	// @notTested
	async deleteOrg(authGroupId, id) {
		const result = await dal.deleteOrg(authGroupId, id);
		ueEvents.emit(authGroupId, 'ue.organization.destroy', result);
	},

	async patchOrg(authGroup, id, update, modifiedBy) {
		const org = await dal.getOrg(authGroup.id || authGroup._id, id);
		const patched = jsonPatch.apply_patch(org.toObject(), update);
		patched.modifiedBy = modifiedBy;
		const result = await dal.patchOrg(authGroup.id || authGroup._id, id, patched);
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.organization.edit', result);
		return result;
	}
};