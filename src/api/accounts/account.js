import jsonPatch from 'jsonpatch';
import dal from './dal';
import helper from '../../helper';

export default {
	async writeAccount(data) {
		data.email = data.email.toLowerCase();
		if(!data.username) data.username = data.email;
		return dal.writeAccount(data);
	},

	async getAccounts(authGroupId, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getAccounts(authGroupId, query);
	},

	async getAccount(authGroupId, id) {
		return dal.getAccount(authGroupId, id);
	},

	async deleteAccount(authGroupId, id) {
		return dal.deleteAccount(authGroupId, id);
	},

	async patchAccount(authGroupId, id, update, modifiedBy) {
		const account = await dal.getAccount(authGroupId, id);
		const patched = jsonPatch.apply_patch(account.toObject(), update);
		patched.modifiedBy = modifiedBy;
		return dal.patchAccount(authGroupId, id, patched);
	},

	async getAccountByEmailOrUsername(authGroupId, em) {
		const email = String(em).toLowerCase();
		return dal.getAccountByEmailOrUsername(authGroupId, email);
	}
};