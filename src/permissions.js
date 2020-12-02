import Boom from '@hapi/boom';
const config = require('./config');
export default {
	async permissionEnforce(req, res, next) {
		const ERROR_MESSAGE = 'You do not have the right permissions';
		try {
			// super admin has full access if "FULL_SUPER_CONTROL" is set to true, otherwise update and delete are disabled
			if(req.permissions && req.permissions.roles && req.permissions.roles.length !== 0 && req.permissions.roles.includes('super')) {
				if(config.FULL_SUPER_CONTROL === true) return next();
				if(superAccess(req)) return next();
				throw Boom.unauthorized('Super Admin is not fully enabled');
			}
			// if we are here, we aren't a super admin, and only they can do cross group queries
			if(req.permissions.sub_group !== req.permissions.req_group) {
				throw Boom.forbidden(ERROR_MESSAGE);
			}

			// auth group owner has full access to their group
			if (req.permissions && req.permissions.roles && req.permissions.roles.length !== 0) {
				const roles = req.permissions.roles;
				let actions;
				const actionsExist = await roles.some((role) => {
					actions = returnActions(req.method, req.path, role);
					return actions.length > 0;
				});
				if(!actionsExist) throw Boom.forbidden(ERROR_MESSAGE);
				const methodAction = translateMethod(req.method);
				if(!methodAction) throw Boom.methodNotAllowed(req.method);
				const final = actions.filter((a) => {
					return a.includes(methodAction) === true;
				});
				if(final.length === 0) throw Boom.forbidden(ERROR_MESSAGE);
				if (final[0].includes(':own')){
					req.permissions.enforceOwn = true;
				}
				return next();
			}
			throw Boom.forbidden(ERROR_MESSAGE);
		} catch (error) {
			next(error);
		}
	}
};

function superAccess (req) {
	return !(req.method !== 'get' && req.method !== 'post');
}

function translateMethod(method) {
	switch (method.toLowerCase()) {
	case 'get':
		return 'read';
	case 'post':
		return 'create';
	case 'patch':
		return 'update';
	case 'put':
		return 'update';
	case 'delete':
		return 'delete';
	default:
		return false;
	}
}

function returnActions(method, path, role) {
	const modPath = `-${path}-`;
	let permissions;
	switch (role) {
	case 'owner':
		permissions = Owner;
		break;
	case 'member':
		permissions = Member;
		break;
	case 'developer':
		permissions = Developer;
		break;
	default:
		permissions = null;
	}
	if(!permissions) return [];
	const targets = Targets.filter((t) => {
		return modPath.includes(`${t}-`) || modPath.includes(`${t}/`);
	});
	if(targets.length === 0) return [];
	const target = targets[0];
	const p = permissions.find((a) => {
		return a.target === target;
	});
	if(!p || !p.actions) return [];
	return p.actions.split(' ');
}

/**
 * Roles: owner, member, developer (dev is only through plugin)
 * Actions: create update:all|own read:all|own delete:all|own
 */
const Targets = ['group', 'groups', 'accounts', 'account', 'clients', 'client', 'operation:client', 'operation', 'token:initial-access', 'token'];
const Owner = [
	{
		target: 'group',
		actions: 'update:own read:own delete:own'
	},
	{
		target: 'accounts',
		actions: 'read:all'
	},
	{
		target: 'account',
		actions: 'create update:all read:all delete:all'
	},
	{
		target: 'client',
		actions: 'read:all update:all delete:all'
	},
	{
		target: 'clients',
		actions: 'read:all'
	},
	{
		target: 'operation:client',
		actions: 'create'
	},
	{
		target: 'operation',
		actions: 'create'
	},
	{
		target: 'token:initial-access',
		actions: 'create'
	}
];

const Member = [
	{
		target: 'account',
		actions: 'update:own read:own delete:own'
	}
];

const Developer = [
	{
		target: 'group',
		actions: 'read:own'
	},
	{
		target: 'account',
		actions: 'create update:own read:all delete:own'
	},
	{
		target: 'client',
		actions: 'read:all update:all'
	},
	{
		target: 'clients',
		actions: 'read:all'
	},
	{
		target: 'operation:client',
		actions: 'create'
	},
	{
		target: 'token:initial-access',
		actions: 'create'
	}
];
