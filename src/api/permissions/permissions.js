import Boom from '@hapi/boom';
import dal from './dal';
import roles from '../roles/roles';
import helper from '../../helper';
import ueEvents from '../../events/ueEvents';

const papi = {
	async writePermission(data) {
		const output = await dal.writePermission(data);
		ueEvents.emit(data.authGroup, 'ue.permission.create', output);
		return output;
	},

	async getPermissions(authGroupId, product, q) {
		let search;
		if(q?.search) {
			search = q.search;
			delete q.search;
		}
		const query = await helper.parseOdataQuery(q);
		if(search) query.query.$text = { $search : search };
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

	async bulkDelete(authGroup, product, ids) {
		const result = await dal.bulkDelete (authGroup, product, ids);
		const output = { rolesImpacted: 'WARNING - bulk delete may orphan permission references in roles', permission: result };
		ueEvents.emit(authGroup, 'ue.permission.destroy', result);
		return output;
	},

	async bulkAdd(authGroup, product, array, user) {
		const permissions = [];
		array.map((p) => {
			const perm = {
				...p,
				authGroup,
				product
			};
			if(user) {
				perm.createdBy = user;
				perm.modifiedBy = user;
			}
			permissions.push(perm);
		});
		return papi.bulkWrite(authGroup, permissions);
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
	},

	async bulkWrite(authGroupId, permissions) {
		const result = await dal.bulkWrite(permissions);
		ueEvents.emit(authGroupId, 'ue.permission.create', result);
		return result;
	},

	async getTargetsOrActions(data, authGroup, product) {
		const result = await dal.getTargetsOrActions(data, authGroup, product);
		let out = {
			id: data,
			values: []
		};
		if(result?.[0]) out = result[0];
		if(out?._id) {
			out.id = out._id;
			delete out._id;
		}
		return out;
	},

	async getTags(authGroup, product) {
		const result = await dal.getTags(authGroup, product);
		let out = {
			id: 'Tags',
			values: []
		};
		if(result?.[0]) out = result[0];
		if(out?._id) {
			out.id = out._id;
			delete out._id;
		}
		return out;
	}
};

export default papi;