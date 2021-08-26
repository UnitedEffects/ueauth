import Boom from '@hapi/boom';
const config = require('./config');

export default {
	async permissionEnforce(req, res, next) {
		const ERROR_MESSAGE = 'You do not have the right permissions';
		try {
			// If there isn't a user, there isn't anything to enforce...
			if(!req.user) return next();
			// If this is an IAT token, there isn't anything to enforce at this level...
			if(req.user.initialAccessToken) return next();

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
				let actions = [];
				await roles.map((role) => {
					if (actions.length === 0) {
						actions = returnActions(req.method, req.path, role);
					}
					else {
						actions = actions.concat(returnActions(req.method, req.path, role));
					}
				});
				const actionsExist = (actions.length !== 0);
				if(!actionsExist) throw Boom.forbidden(ERROR_MESSAGE);
				const methodAction = translateMethod(req.method);
				if(!methodAction) throw Boom.methodNotAllowed(req.method);
				let final = actions.filter((a) => {
					return a.includes(methodAction) === true;
				});
				if(final.length === 0) throw Boom.forbidden(ERROR_MESSAGE);
				if(final.length > 1) {
					// de-dup
					final = final.reduce((unique, item) => unique.includes(item) ? unique : [...unique, item], []);
					// prioritize "all"
					const x = [];
					await final.forEach((f) => {
						x.push(f.split(':')[0]);
					});
					const y = x.reduce((unique, item) => unique.includes(item) ? unique : [...unique, item], []);
					await y.forEach((z) => {
						if((final.includes(`${z}:all`) || final.includes(z)) && final.includes(`${z}:own`)){
							final = final.filter((f) => {
								return !f.includes(`${z}:own`);
							});
						}
					});
				}
				// This may need revising when full permissions are implemented via IAM
				if (final[0].includes(':own')){
					req.permissions.enforceOwn = true;
				}
				return next();
			}
			throw Boom.forbidden(ERROR_MESSAGE);
		} catch (error) {
			next(error);
		}
	},
	async enforceOwn(p, resourceOwner) {

		if(p.enforceOwn === true) {
			if(!p.agent) throw Boom.forbidden();
			if(!p.agent.sub) throw Boom.forbidden();
			if(p.agent.sub !== resourceOwner) {
				console.error('unauthorized resource request');
				throw Boom.notFound(resourceOwner);
			}
		}

	}
};

function superAccess (req) {
	if(!req.path.includes('plugins')) return !(req.method !== 'get' && req.method !== 'post');
	else return true;
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
	case 'client':
		permissions = Client;
		break;
	default:
		permissions = null;
	}
	if(!permissions) return [];
	//narrow it down
	let targets = Targets.filter((t) => {
		t = t.split(':').join('/');
		return modPath.includes(`${t}-`) || modPath.includes(`${t}/`);
	});
	const possiblePerms = permissions.filter((p) => {
		return targets.includes(p.target);
	});
	if(possiblePerms.length === 1) {
		return possiblePerms[0].actions.split(' ');
	}
	targets = [];
	for(let x=0; x<possiblePerms.length; x++) {
		targets.push(possiblePerms[x].target);
	}
	//look for compound paths and pick a target
	const compoundTargets = targets.filter((t) => {
		return t.includes(':');
	});
	targets = targets.filter(x => !compoundTargets.includes(x));
	//check compound first
	let target = [];
	if(compoundTargets.length !== 0) {
		for(let x=0; x<compoundTargets.length; x++) {
			if(target.length === 0) {
				if(modPath.includes(compoundTargets[x].split(':').join('/'))) {
					target.push(compoundTargets[x]);
				}
			}
		}
	}
	if(target.length === 0) {
		//try non compound targets
		const paths = modPath.split('/');
		for(let x=0; x<paths.length; x++) {
			if(target.length === 0) {
				if(targets.includes(paths[x])) {
					target.push(paths[x]);
				}
			}
		}
	}
	if(targets.length === 0) return [];
	const t = target[0];
	const p = permissions.find((a) => {
		return a.target === t;
	});
	if(!p || !p.actions) return [];
	return p.actions.split(' ');
}

/**
 * Roles: owner, member, developer (dev is only through plugin)
 * Actions: create update:all|own read:all|own delete:all|own
 */
const Targets = ['group', 'groups', 'accounts', 'invite', 'invites', 'accept', 'account', 'clients', 'client', 'operations:client', 'operations:reset-user-password', 'operations:user', 'operations:invite', 'operations', 'token:initial-access', 'token', 'notification', 'notifications'];

// this roles is for client-credential tokens
const Client = [
	{
		target: 'group',
		actions: 'read:own'
	},
	{
		target: 'account',
		actions: 'read:all'
	},
	{
		target: 'invite',
		actions: 'read:all'
	},
	{ //delete this
		target: 'clients',
		actions: 'read:all update:own'
	},
	{
		target: 'client',
		actions: 'read:own update:own'
	},
	{
		target: 'notification',
		actions: 'create read:all update:all'
	},
	{
		target: 'operations:reset-user-password',
		actions: 'create'
	},
	{
		target: 'operations:client',
		actions: 'create:own'
	}
]

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
		target: 'invite',
		actions: 'create read:all delete:all'
	},
	{
		target: 'invites',
		actions: 'read:all'
	},
	{
		target: 'accept',
		actions: 'create'
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
		target: 'operations',
		actions: 'create'
	},
	{
		target: 'token:initial-access',
		actions: 'create'
	},
	{
		target: 'notifications',
		actions: 'create read:all delete:all update:all'
	},
	{
		target: 'notification',
		actions: 'create read:all delete:all update:all'
	}
];

const Member = [
	{
		target: 'account',
		actions: 'update:own read:own delete:own'
	},
	{
		target: 'invite',
		actions: 'read:own'
	},
	{
		target: 'invites',
		actions: 'read:own'
	},
	{
		target: 'accept',
		actions: 'create'
	},
	{
		target: 'operations:reset-user-password',
		actions: 'create'
	},
	{
		target: 'operations:user',
		actions: 'create:own'
	},
	{
		target: 'operations:invite',
		actions: 'create:own'
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
		target: 'invite',
		actions: 'read:all'
	},
	{
		target: 'accept',
		actions: 'create'
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
