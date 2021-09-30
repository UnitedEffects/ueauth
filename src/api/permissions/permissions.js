import jsonPatch from 'jsonpatch';
import Boom from '@hapi/boom';
import dal from './dal';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';
import access from '../accounts/access';

export default {
	async writePermission(data) {
		const output = await dal.writePermission(data);
		ueEvents.emit(data.authGroup, 'ue.permission.create', output);
		return output;
	},

	async getPermissions(authGroupId, product, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getPermissions(authGroupId, product, query);
	},

	async getPermission(authGroupId, product, id) {
		return dal.getPermission(authGroupId, product, id);
	},

	async deletePermission(authGroupId, product, id) {
		const result = await dal.deletePermission(authGroupId, product, id);
		ueEvents.emit(authGroupId, 'ue.permission.destroy', result);
		return result;
	}
};