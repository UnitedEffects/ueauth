import Boom from '@hapi/boom';
import dal from './dal';
import role from '../../roles/roles';
import ueEvents from '../../../events/ueEvents';

function cleanupAccessResponse(object) {
	let result = object;
	if(result && result._id && result.payload && result.payload.auth_group) {
		result = JSON.parse(JSON.stringify(result));
		result.id = result._id;
		result.authGroup = result.payload.auth_group;
		if(!result.access) result.access = {};
		delete result._id;
		delete result.payload;
	}
	return result;
}

export default {
	async removeClientAccess(authGroup, id, product) {
		let result = await dal.removeClientAccess(authGroup, id, product);
		result = cleanupAccessResponse(result);
		ueEvents.emit(authGroup, 'ue.client.access.destroy', result);
		return result;
	},
	async getClientAccess(authGroup, id) {
		let result = await dal.getClientAccess(authGroup, id);
		result = cleanupAccessResponse(result);
		return result;
	},
	async getFormattedClientAccess(authGroup, id, token) {
		let result = await dal.getClientAccess(authGroup, id);
		if(!result) throw Boom.unauthorized();
		result = cleanupAccessResponse(result);
		const response = {
			sub: id,
			type: 'client',
			authGroup: result.authGroup,
			member: (result.authGroup === authGroup.id),
		};
		if(token.scope.includes('access') && result.access.roles && result.access.product) {
			response.products = result.access.product;
			const roles = [];
			const permissions = [];
			const roleTask = result.access.roles.map(async (rl) => {
				const myRole = await role.getRole(authGroup.id, result.access.product, rl);
				roles.push(`${myRole.productCodedId || myRole.product}::${myRole.codedId}`);
				myRole.permissions.map((p) => {
					const perm = p.split(' ');
					if(perm.length === 2) {
						permissions.push(`${myRole.productCodedId || myRole.product}:::${perm[1]}`);
					}
				});
				return rl;
			});
			await Promise.all(roleTask);
			response.productRoles = roles.join(' ');
			response.permissions = permissions.join(' ');
		}
		if(token?.['x-organization-context']) {
			response.orgContext = token['x-organization-context'];
		}
		return response;
	},
	async applyClientAccess(authGroup, id, access) {
		if(!access || !access.roles || !Array.isArray(access.roles)) throw new Error('incorrect input. access.roles should be an array');
		if(!access || !access.product) throw new Error('incorrect input. access.product should exist');
		const errors = [];
		const task = access.roles.map(async (rl) => {
			const check = await role.getRole(authGroup, access.product, rl);
			if(!check) errors.push(`role not found: ${rl}`);
			return check;
		});
		await Promise.all(task);
		if(errors.length !== 0) throw Boom.preconditionRequired('One or more of the roles specified do not exist', errors);
		let result = await dal.applyClientAccess(authGroup, id, access);
		result = cleanupAccessResponse(result);
		ueEvents.emit(authGroup, 'ue.client.access.defined', result);
		return result;
	},
	async checkRoles(ag, id) {
		const result = await dal.checkRoles(ag, id);
		if(result.length === 0) return false;
		return result;
	}
};