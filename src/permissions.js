import Boom from '@hapi/boom';
import access from './api/accounts/access';
import helper from './helper';
const config = require('./config');

export default {
	enforce(target, ...args) {
		return function (req, res, next) {
			const ERROR_MESSAGE = 'You do not have the right permissions';
			try {
				// ensure middleware provides a target
				if (!target) throw Boom.internal('Permissions enforcement middleware requires a target that maps to known permissions');
				// if there is no user, assume no access
				if (!req.user) {
					if(req.accountCreationRequest === true && req.authGroup.locked === false) return next();
					throw Boom.unauthorized();
				}
				if (req.user.initialAccessToken) return next();
				// ensure there are permissions... there should at least be member info
				if (!req.permissions) throw Boom.unauthorized();
				// ensure a core product exists
				if (!req.permissions.core || !req.permissions.core.products) throw Boom.forbidden(ERROR_MESSAGE);
				// ensure group access
				if (!req.permissions.groupAccess || !req.permissions.groupAccess.length) throw Boom.forbidden(ERROR_MESSAGE);
				// if root user, they have priority
				if (req.permissions.groupAccess.includes('super')) {
					if (config.FULL_SUPER_CONTROL === true) return next();
					if (superAccess(req)) return next();
					throw Boom.unauthorized('Super Admin is not fully enabled');
				}
				// ensure group member
				if (!req.permissions.groupAccess.includes('member')) throw Boom.forbidden(ERROR_MESSAGE);
				let bFound = false;
				let requestTarget;
				let targets = [target];
				if(args.length) {
					targets = targets.concat(args);
				}
				const requestAction = translateMethod(req.method);
				if(!requestAction) throw Boom.methodNotAllowed(req.method);
				targets.map((t) => {
					if(bFound === false) {
						requestTarget = (!requestTarget) ? t : `${requestTarget}-${t}`;
						const productList = (req.permissions.core.productCodedIds.length) ?
							req.permissions.core.productCodedIds : req.permissions.core.products;
						productList.push(`${req.authGroup.id}-member`);
						let requestPermissions = [];
						productList.map((pcId) => {
							let thisRequest = `${pcId}:::${requestTarget}::${requestAction}`;
							let temp = req.permissions.permissions.filter((p) => {
								return p.includes(thisRequest);
							});
							requestPermissions = requestPermissions.concat(temp);
						});
						if(requestPermissions.length !== 0) {
							bFound = true;
							const checkOwn = requestPermissions.filter((p) => {
								return (p.includes(':own'));
							});
							if(checkOwn.length === requestPermissions.length) {
								req.permissions.enforceOwn = true;
							}
						}
					}
				});

				if(bFound === false) throw Boom.forbidden(ERROR_MESSAGE);
				return next();
			} catch (error) {
				next(error);
			}
		};
	},
	async permissions(req, res, next) {
		try {
			if(!req.permissions) req.permissions = {};
			req.permissions = {
				groupAccess: [],
				enforceOwn: false
			};
			if(!req.user) return next();
			if(!req.authGroup) return next();
			if(req.user.initialAccessToken) return next();
			req.permissions.sub = req.user.sub;
			req.permissions.sub_group = req.user.subject_group.id;
			req.permissions.req_group = req.authGroup.id;
			if(req.user.decoded) {
				if(req.user.decoded.scope) req.permissions.scopes = req.user.decoded.scope.split(' ');
				let accessObject = JSON.parse(JSON.stringify(req.user.decoded));
				if(req.user.decoded['x-access-url']) {
					accessObject = {};
					const userAccess = await access.getUserAccess(req.user.subject_group.id, req.user.sub, { minimized: true });
					if(userAccess) {
						if(userAccess.owner === true) accessObject['x-access-group'] = 'owner';
						if(userAccess.member === true) {
							if(!accessObject['x-access-group']) accessObject['x-access-group'] = 'member';
							else accessObject['x-access-group'] = (`${accessObject['x-access-group']} member`).trim();
						}
						if(userAccess.orgs) accessObject['x-access-organizations'] = userAccess.orgs;
						if(userAccess.orgDomains) accessObject['x-access-domains'] = userAccess.orgDomains;
						if(userAccess.products) accessObject['x-access-products'] = userAccess.products;
						if(userAccess.productRoles) accessObject['x-access-roles'] = userAccess.productRoles;
						if(userAccess.permissions) accessObject['x-access-permissions'] = userAccess.permissions;
					}
				}
				if(accessObject['x-access-group']) {
					if (req.permissions.sub_group === req.permissions.req_group) {
						req.permissions.groupAccess = accessObject['x-access-group'].split(' ');
					}
				}
				if(accessObject['x-access-organizations']) req.permissions.organizations = accessObject['x-access-organizations'].split(' ');
				if(accessObject['x-access-domains']) req.permissions.domains = accessObject['x-access-domains'].split(' ');
				if(accessObject['x-access-products']) req.permissions.products = accessObject['x-access-products'].split(' ');
				if(accessObject['x-access-roles']) req.permissions.roles = accessObject['x-access-roles'].split(' ');
				if(accessObject['x-access-permissions']) req.permissions.permissions = accessObject['x-access-permissions'].split(' ');
			}

			// Root super user
			if(req.user.subject_group && req.user.subject_group.prettyName === 'root') {
				if(req.user.group === req.permissions.sub_group){
					if(!req.permissions.groupAccess) req.permissions.groupAccess = [];
					req.permissions.groupAccess.push('super');
				}
			}
			// todo, remove this once client_access is implemented
			if(req.user.client_credential === true) {
				if(!req.permissions.roles) req.permissions.roles = [];
				req.permissions.roles.push('client');
			}

			// we look up the core product and ensure all the permissions match the id associated.
			const coreProducts = await helper.cacheCoreProduct(req.query.resetCache, req.authGroup);
			if(!coreProducts.length) throw new Error('Could not identify core products for this authgroup');
			req.permissions.core = {
				group: req.permissions.req_group,
				products: [],
				productCodedIds: []
			};
			coreProducts.map((p) => {
				req.permissions.core.products.push(p.id || p._id);
				req.permissions.core.productCodedIds.push(p.codedId);
			});
			// filtering out any product references that are not the core from the user's permissions
			// todo this is probably not needed and not good
			/*
			if(req.permissions.products) {
				req.permissions.products = req.permissions.products.filter((p) => {
					return (req.permissions.core.products.includes(p));
				});
			}

			 */
			// filtering out any permissions that are not from the core product from the user's permissions
			let permFilter = [];
			let roleFilter = [];
			req.permissions.core.productCodedIds.map((ci) => {
				if(req.permissions.permissions) {
					const temp = req.permissions.permissions.filter((p) => {
						return (p.includes(`${ci}:::`));
					});
					permFilter = permFilter.concat(temp);
				}
				if(req.permissions.roles) {
					const temp = req.permissions.roles.filter((r) => {
						return (r.includes(`${ci}::`));
					});
					roleFilter = roleFilter.concat(temp);
				}
			});
			req.permissions.core.products.map((pr) => {
				if(req.permissions.permissions) {
					const temp = req.permissions.permissions.filter((p) => {
						return (p.includes(`${pr}:::`));
					});
					permFilter = permFilter.concat(temp);
				}
				if(req.permissions.roles) {
					const temp = req.permissions.roles.filter((r) => {
						return (r.includes(`${pr}::`));
					});
					roleFilter = roleFilter.concat(temp);
				}
			});
			// ensure member permissions are preserved
			if(req.permissions.permissions) {
				const temp = req.permissions.permissions.filter((p) => {
					return (p.includes(`${req.authGroup.id}-member:::`));
				});
				permFilter = permFilter.concat(temp);
			}
			// filtering out any permissions that are not part of the core products
			if(req.permissions.permissions) {
				req.permissions.permissions = permFilter;
			}
			// filtering out any roles that are not from the core product from the user's permissions
			if(req.permissions.roles) {
				req.permissions.roles = roleFilter;
			}

			req.permissions.permissions = [...new Set(req.permissions.permissions)];
			return next();
		} catch (error) {
			next(error);
		}
	},
	async enforceOwn(p, resourceOwner) {
		if(p.enforceOwn === true) {
			if(!p.sub) throw Boom.forbidden();
			if(p.sub !== resourceOwner) {
				throw Boom.notFound(resourceOwner);
			}
		}
	},
	async enforceOwnOrg(p, org) {
		if(p.enforceOwn === true) {
			if(!p.organizations) throw Boom.forbidden('You should request the access or access::organization scope');
			if(!p.organizations.length) throw Boom.forbidden();
			if(!p.organizations.includes(org)) throw Boom.forbidden();
		}
	},
	async enforceOwnDomain(p, org, domain) {
		if(p.enforceOwn === true) {
			if(!p.domains) throw Boom.forbidden('You should request the access or access::domain scope');
			if(!p.domains.length) throw Boom.forbidden();
			if(!p.domains.includes(`${org}::${domain}`)) throw Boom.forbidden();
		}
	},
	async enforceOwnProduct(p, product) {
		if(p.enforceOwn === true) {
			if(!p.products) throw Boom.forbidden('You should request the access or access::products scope');
			if(!p.products.length) throw Boom.forbidden();
			if(!p.products.includes(product)) throw Boom.forbidden();
		}
	},
	async enforceRoot(p) {
		if(!p.groupAccess.includes('super')) throw Boom.forbidden();
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

/**

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
];
 */