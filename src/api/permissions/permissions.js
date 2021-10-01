import Boom from '@hapi/boom';
import dal from './dal';
import roles from '../roles/roles';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';

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
		const permission = await dal.getPermission(authGroupId, product, id);
		if(!permission) throw Boom.notFound(`id requested was ${id}`);
		const coded = `${id} ${permission.coded}`;
		const rolesCleared = await roles.clearPermission(authGroupId, product, coded);
		const result = await dal.deletePermission(authGroupId, product, id);
		const output = { rolesImpacted: rolesCleared, permission: result };
		ueEvents.emit(authGroupId, 'ue.permission.destroy', output);
		return output;
	},

	async deletePermissionsByProduct(authGroupId, product) {
		const result = await dal.deletePermissionsByProduct(authGroupId, product);
		ueEvents.emit(authGroupId, 'ue.permission.destroy', { authGroup: authGroupId, product, result });
		return result;
	},

	async checkForProductReference(authGroup, product) {
		const result = await dal.checkForProductReference(authGroup, product);
		return {
			totalReferences: result.length,
			permissionIds: result
		};
	}
};