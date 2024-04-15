import Boom from '@hapi/boom';
import access from './api/accounts/access';
import roles from './api/roles/roles';
import helper from './helper';
import logs from './api/logging/logs';
const config = require('./config');

export default {
	setRoleTarget(target) {
		return function (req, res, next) {
			try {
				req.roleTarget = target;
				return next();
			} catch (error) {
				next(error);
			}
		}
	},
	/**
	 * NOTE: This is not highly performant. This should only be used where enforce on its own would not work such as with APIs specific to
	 * AuthGroup Root that you wish to empower a service client to access. Must be preceded with setRoleTarget;
	 * @param req
	 * @param res
	 * @param next
	 * @returns {Promise<*>}
	 */
	async enforceRole(req, res, next) {
		const ERROR_MESSAGE = 'You do not have the right roles';
		//console.info(req.permissions);
		//console.info(req.user);
		try {
			const target = req.roleTarget;
			// ensure middleware provides a target
			if (!target) throw Boom.internal('Role enforcement middleware requires a target that maps to known role');
			// if there is no user, assume no access
			if (!req.user) throw Boom.unauthorized();
			// ensure there are permissions... there should at least be member info
			if (!req.permissions) throw Boom.forbidden(ERROR_MESSAGE)
			// if root user, they have priority
			if (req.permissions?.groupAccess?.includes('super')) {
				if (config.FULL_SUPER_CONTROL === true) return next();
				if (superAccess(req)) return next();
				throw Boom.unauthorized('Super Admin is not fully enabled');
			}
			// ensure a core product exists
			if (!req.permissions?.core?.products) throw Boom.forbidden(ERROR_MESSAGE);
			// ensure group access
			if (!req.permissions?.groupAccess?.length) throw Boom.forbidden(ERROR_MESSAGE);
			// ensure group member
			if (!req.permissions?.groupAccess?.includes('member')) throw Boom.forbidden(ERROR_MESSAGE);

			let access = false;

			if(req.permissions?.roles && Array.isArray(req.permissions.roles)) {
				await Promise.all(req.permissions?.roles?.map(async(rid) => {
					if(access === false) {
						const array = rid.split('::');
						const ag = (req.permissions?.groupAccess?.includes('client-super')) ? req.permissions.sub_group : req.authGroup.id;
						const role = await roles.getRole(ag, array[0], array[1]);
						if(role.name === target) access = true;
					}
					return rid;
				}))
			}
			if(access === false) throw Boom.forbidden(ERROR_MESSAGE);
			return next();
		} catch (error) {
			next(error);
		}
	},
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
				if (req.user?.initialAccessToken) return next();
				// ensure there are permissions... there should at least be member info
				if (!req.permissions) throw Boom.unauthorized();
				// if root user (not client), they have priority
				if (req.permissions?.groupAccess?.includes('super')) {
					if (config.FULL_SUPER_CONTROL === true) return next();
					if (superAccess(req)) return next();
					throw Boom.forbidden('Super Admin is not fully enabled');
				}
				// allow owner through no matter what...
				if (req.user?.sub === req.authGroup?.owner) {
					return next();
				}
				// ensure a core product exists
				if (!req.permissions?.core || !req.permissions.core.products) throw Boom.forbidden(ERROR_MESSAGE);
				// ensure group access
				if (!req.permissions?.groupAccess || !req.permissions.groupAccess.length) throw Boom.forbidden(ERROR_MESSAGE);
				// ensure group member
				if (!req.permissions?.groupAccess?.includes('member')) throw Boom.forbidden(ERROR_MESSAGE);
				let bFound = false;
				let requestTarget;
				let targets = [target];
				// ensure the request has an organization context
				const context = req.permissions.orgContext;
				if (!context) throw Boom.forbidden(ERROR_MESSAGE);
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
							let thisRequest = `${pcId}:::${(`${requestTarget}::${requestAction}`).toLowerCase()}`;
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
			// ensure the request has an organization context
			const inferredContext = (req.orgContext) ? req.orgContext.id : undefined;
			let context = (req.orgContext) ? req.orgContext.id : undefined;
			const primary = (req.primaryOrg) ? req.primaryOrg.id : undefined;
			let mergePrimary = false;
			if(context !== primary) mergePrimary = true;
			if(!req.permissions) req.permissions = {};
			req.permissions = {
				orgContext: context,
				apiAgent: (req.user?.client_credential === true),
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
				// if we have an org context in the token, use it, otherwise used the previously inferredContext
				if(req.user.decoded['x-organization-context']) {
					context = req.user.decoded['x-organization-context'];
					req.permissions.orgContext = context;
					if(context !== primary) mergePrimary = true;
					if(inferredContext !== context) {
						logs.record(`NOTE FOR FUTURE REFINEMENT, INFERRED CONTEXT NOT SAME AS TOKEN CONTEXT. Inferred: ${inferredContext}, Token: ${context}`);
					}
				}
				if(req.user.decoded['x-access-url']) {
					accessObject = {};
					const userAccess = await access.getUserAccess(req.user.subject_group, req.user.sub, { minimized: true });
					if(userAccess) {
						if(userAccess.owner === true) accessObject['x-access-group'] = 'owner';
						if(userAccess.member === true) {
							if(!accessObject['x-access-group']) accessObject['x-access-group'] = 'member';
							else accessObject['x-access-group'] = (`${accessObject['x-access-group']} member`).trim();
						}
						if(userAccess.orgs) accessObject['x-access-organizations'] = userAccess.orgs;
						if(userAccess.domains) accessObject['x-access-domains'] = userAccess.domains;
						if(userAccess.products) accessObject['x-access-products'] = userAccess.products;
						if(userAccess.productRoles) accessObject['x-access-roles'] = userAccess.productRoles;
						if(userAccess.permissions) accessObject['x-access-permissions'] = userAccess.permissions;
					}
				}
				if(accessObject['x-access-group']) {
					if (req.permissions.sub_group === req.permissions.req_group) {
						req.permissions.groupAccess = accessObject['x-access-group'].split(' ');
					} else if (req.user?.subject_group?.name === 'root') {
						req.permissions.groupAccess = accessObject['x-access-group'].split(' ');
					}
				}
				if(accessObject['x-access-organizations']) req.permissions.organizations = accessObject['x-access-organizations'].split(' ');
				if(req.permissions.apiAgent === true) req.permissions.organizations = [context];
				if(accessObject['x-access-domains']) {
					if(req.permissions.organizations && req.permissions.organizations.includes(context) && accessObject['x-access-domains'][context]) {
						req.permissions.domains = accessObject['x-access-domains'][context].split(' ');
					}
					if(mergePrimary) {
						if(req.permissions.organizations && req.permissions.organizations.includes(primary) && accessObject['x-access-domains'][primary]) {
							if(!req.permissions.domains) req.permissions.domains = [];
							req.permissions.domains = req.permissions.domains.concat(accessObject['x-access-domains'][primary].split(' '));
						}
					}
				}
				if(accessObject['x-access-products']) {
					if(req.permissions.apiAgent === true) {
						req.permissions.products = accessObject['x-access-products'].split(' ');
					} else {
						if(req.permissions?.organizations?.includes(context) && accessObject['x-access-products'][context]) {
							req.permissions.products = accessObject['x-access-products'][context].split(' ');
						}
						if(mergePrimary) {
							if(req.permissions.organizations && req.permissions.organizations.includes(primary) && accessObject['x-access-products'][primary]) {
								if(!req.permissions.products) req.permissions.products = [];
								req.permissions.products = req.permissions.products.concat(accessObject['x-access-products'][primary].split(' '));
							}
						}
						const temp = [];
						if(req.permissions.products) {
							req.permissions.products.map((p) => {
								temp.push(p.split(',')[0]);
								return p;
							});
							req.permissions.products = temp;
						}
					}
				}
				if(accessObject['x-access-roles']) {
					if(req.permissions.apiAgent === true) {
						req.permissions.roles = accessObject['x-access-roles'].split(' ');
					} else {
						if(req.permissions?.organizations?.includes(context) && accessObject['x-access-roles'][context]) {
							req.permissions.roles = accessObject['x-access-roles'][context].split(' ');
						}
						if(mergePrimary) {
							if(req.permissions.organizations && req.permissions.organizations.includes(primary) && accessObject['x-access-roles'][primary]) {
								if(!req.permissions.roles) req.permissions.roles = [];
								req.permissions.roles = req.permissions.roles.concat(accessObject['x-access-roles'][primary].split(' '));
							}
						}
					}
				}
				if(accessObject['x-access-permissions']) {
					if(req.permissions.apiAgent === true) {
						if(req.permissions?.organizations?.includes(context)) {
							req.permissions.permissions = accessObject['x-access-permissions'].split(' ');
						}
					} else {
						if(req.permissions?.organizations?.includes(context) && accessObject['x-access-permissions'][context]) {
							req.permissions.permissions = accessObject['x-access-permissions'][context].split(' ');
						}
						if(mergePrimary) {
							if(req.permissions.organizations && req.permissions.organizations.includes(primary) && accessObject['x-access-permissions'][primary]) {
								if(!req.permissions.permissions) req.permissions.permissions = [];
								req.permissions.permissions = req.permissions.permissions.concat(accessObject['x-access-permissions'][primary].split(' '));
							}
						}
						if(accessObject['x-access-permissions'].member && req.permissions.groupAccess.includes('member')) {
							if(!req.permissions.permissions) req.permissions.permissions = [];
							req.permissions.permissions = req.permissions.permissions.concat(accessObject['x-access-permissions'].member.split(' '));
						}
					}
				}
			}

			// Root super user
			if(req.user.subject_group && req.user.subject_group.prettyName === 'root') {
				if((req.user.group || req.user.auth_group) === req.permissions.sub_group){
					if(!req.permissions.groupAccess) req.permissions.groupAccess = [];
					if(req.user.client_credential !== true) {
						// this only applies to people not clients
						req.permissions.groupAccess.push('super');
					} else req.permissions.groupAccess.push('client-super');
				}
			}

			// we look up the core product and ensure all the permissions match the id associated.
			const coreProducts = await helper.cacheCoreProduct(req.query.resetCache, req.authGroup);
			const coreOrg = await helper.cachePrimaryOrg(req.query.resetCache, req.authGroup);

			if(!coreProducts.length) throw new Error('Could not identify core products for this authgroup');

			// create a non-contextual product list from the token to see if they have admin access to UE Auth through any org
			if(req.user.decoded?.['x-access-products']) {
				const nonContextCoreProducts = [];
				const nonContextCoreProductCodes = [];
				Object.keys(req.user.decoded['x-access-products']).map((key) => {
					const products = req.user.decoded['x-access-products'][key].split(' ');
					products.map((p) => {
						const val = p.split(',');
						if (val.length) {
							const found = coreProducts.filter((c) => {
								return (val[0] === (c._id || c.id));
							});
							if (found.length) {
								nonContextCoreProducts.push(val[0]);
								if (val.length > 1) nonContextCoreProductCodes.push(val[1]);
							}
						}
					})
				})
				if(nonContextCoreProducts.length) {
					req.permissions.noContextCore = nonContextCoreProducts;
					req.permissions.noContextCoreCodes = nonContextCoreProductCodes;
				}
			}

			req.permissions.core = {
				group: req.permissions.req_group,
				products: [],
				productCodedIds: []
			};
			if(coreOrg?.id) {
				req.permissions.core.org = {
					id: coreOrg.id,
					name: coreOrg.name,
					description: coreOrg.description,
					contact: coreOrg.contactEmail
				};
			}
			coreProducts.map((p) => {
				req.permissions.core.products.push(p.id || p._id);
				req.permissions.core.productCodedIds.push(p.codedId);
			});

			// filtering out any permissions that are not from the core product from the user's permissions
			let permFilter = [];
			let roleFilter = [];

			if(req.permissions.apiAgent !== true && req.user?.subject_group?.name !== 'root') {
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
			} else {
				roleFilter = req.permissions.roles;
				permFilter = req.permissions.permissions;
			}

			if(req.user?.client_credential !== true) {
				// ensure member permissions are preserved
				const temp = req.permissions?.permissions?.filter((p) => {
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

			// duplicate permissions for core products of root if this is a super-client
			if(req.permissions.groupAccess.includes('client-super') &&
				req.permissions.apiAgent === true &&
				req.user?.subject_group.name === 'root') {

				const corePerms = [];
				if(req.permissions?.core?.productCodedIds) {
					req.permissions.core.productCodedIds.map(pid => {
						if(req.permissions?.permissions) {
							req.permissions.permissions.map((p) => {
								if(!p.includes(pid)) {
									if(p.includes(':::')){
										const t = p.split(':::');
										if(t.length > 1) corePerms.push(`${pid}:::${t[1]}`)
									} else if(p.includes('::')) {
										corePerms.push(`${pid}:::${p}`)
									}
								}
							})
						}
					})
				}

				req.permissions.permissions = req.permissions.permissions || [];
				req.permissions.permissions = [
					...req.permissions.permissions,
					...corePerms
				]
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
		if(!p.groupAccess.includes('super') && !p.groupAccess.includes('client-super')) throw Boom.forbidden();
	},
	async canAccessGroupKeys(p) {
		let keyPerms = [];
		if(p && p.core) {
			const core = p.core.productCodedIds;
			core.map((prod) => {
				keyPerms = keyPerms.concat(p.permissions.filter((p) => {
					return p.includes(`${prod}:::group-keys::read:own`);
				}));
			});
		}
		return !(keyPerms.length === 0 && !p.groupAccess.includes('super'));
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