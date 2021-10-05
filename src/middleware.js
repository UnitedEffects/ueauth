import { OpenApiValidator } from 'express-openapi-validate';
import Boom from '@hapi/boom';
import handleErrors from './customErrorHandler';
import { sayMiddleware } from './say';
import authorizer from './auth/auth';
import helper from './helper';
import orgs from './api/orgs/orgs';
import product from './api/products/product';
import account from './api/accounts/account';
import enforce from './permissions';
import mongoose from 'mongoose';
import swag from './swagger';
import plugins from './api/plugins/plugins';
import access from './api/accounts/access';

const config = require('./config');
const p = require('../package.json');
const date = new Date();    
const schema = new OpenApiValidator(swag, { ajvOptions: { formats: { email: true, password: true, uri: true, url: true, uuid: true } } });

const mid = {
	assets (req, res, next) {
		try {
			res.locals.assets = config.STATIC_ASSETS;
			if(config.CUSTOM_FONTS_URL) {
				res.locals.customFonts = config.CUSTOM_FONTS_URL;
			}
			next();
		} catch (error) {
			next(error);
		}
	},
	cores (req, res, next) {
		try {
			res.header('Access-Control-Allow-Origin', '*');
			res.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, DELETE, PUT, PATCH, OPTIONS');
			res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, api_key, Authorization');
			next();
		} catch (error) {
			next(error);
		}
	},
	catch404 (req, res, next) {
		try {
			next(handleErrors.catch404());
		} catch (error) {
			next(error);
		}
	},
	async catchErrors (err, req, res, next) {
		try {
			if(config.ENV !== 'production') console.info(err);
			const error = await handleErrors.parse(err);
			if(req.method.toLowerCase() === 'get' && !req.path.includes('/api')) {
				if(req.headers.accept !== 'application/json') {
					if(error.statusCode === 404) {
						return res.render('error', { title: 'Not sure what you\'re looking for...', message: 'But, it looks like you may have gone to a bad URL', details: Object.entries(error).map(([key, value]) => `<p><strong>${key}</strong>: ${value}</p>`).join('') });
					}
					return res.render('error', { title: 'oops! something went wrong', message: error.message, details: error.error });
				}
			}
			return res.respond(error);
		} catch (error) {
			console.info('MIDDLEWARE - ERROR HANDLER ISSUE');
			console.info(error);
		}
	},
	responseIntercept: sayMiddleware.responseIntercept,
	async health (req, res) {
		return res.json(
			{
				server: 'running',
				db: mongoose.STATES[mongoose.connection.readyState]
			}
		);
	},
	async version (req, res) {
		return res.json( {
			data: {
				api: p.name,
				version: p.version,
				copyright: `Copyright (c) ${date.getFullYear()} United Effects LLC`
			}
		});
	},
	async schemaCheck(req, res, next) {
		try {
			let path  = `/api${req.route.path}`;
			await Promise.all(Object.keys(req.params).map((p)=>{
				path = path.replace(`:${p}`, `{${p}}`);
			}));
			return schema.validate(req.method.toString().toLowerCase(), path.toLowerCase())(req, res, next);
		} catch (error) {
			next(Boom.expectationFailed(error.message || 'Something unexpected went wrong validating OpenAPI Schema'));
		}
	},
	async getGlobalPluginSettings(req, res, next) {
		try {
			req.globalSettings = await plugins.getLatestPluginOptions();
			return next();
		} catch (error) {
			next(error);
		}
	},
	async validateNotificationRequest(req, res, next) {
		try {
			// assumes authgroup validation and global settings middleware have already run
			if(req.globalSettings.notifications.enabled !== true) throw Boom.methodNotAllowed('Global Notifications have not been set');
			if(req.authGroup.pluginOptions.notification.enabled !== true) throw Boom.methodNotAllowed('Your AuthGroup has not been configured for notifications');
			return next();
		} catch (error) {
			next(error);
		}
	},
	async validateAuthGroup (req, res, next) {
		try {
			// special case for /group paths
			if (req.path.includes('/group/')){
				if (req.params.id) {
					req.params.group = req.params.id;
				}
			}

			// ensure plugins are root only
			if (req.path.includes('/plugins/')){
				req.params.group = 'root';
			}

			if (!req.params.group) throw Boom.preconditionRequired('authGroup is required');
			if (helper.protectedNames(req.params.group)) throw Boom.notFound('auth group not found');
			const result = await helper.cacheAG(req.query.resetCache, 'AG', req.params.group);
			req.authGroup = result;
			req.params.group = result._id || result.id;
			return next();
		} catch (error) {
			next(error);
		}
	},
	async validateOrganization (req, res, next) {
		try {
			if (!req.params.org) throw Boom.preconditionRequired('organization ID is required');
			if (!req.authGroup) throw Boom.preconditionRequired('AuthGroup is required');
			req.organization = await orgs.getOrg(req.authGroup.id, req.params.org);
			return next();
		} catch (error) {
			next(error);
		}
	},
	async validateProduct (req, res, next) {
		try {
			if (!req.params.product) throw Boom.preconditionRequired('product ID is required');
			if (!req.authGroup) throw Boom.preconditionRequired('AuthGroup is required');
			req.product = await product.getProduct(req.authGroup.id, req.params.product);
			return next();
		} catch (error) {
			next(error);
		}
	},
	async permissions(req, res, next) {
		try {
			if(!req.permissions) req.permissions = {};
			req.permissions = {
				enforceOwn: false
			};
			if(!req.user) return next();
			if(!req.authGroup) return next();
			if(req.user.initialAccessToken) return next(); //todo verify this flow
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
						// not adding the rest for now since we do not need them
						if(userAccess.productRoles) accessObject['x-access-roles'] = userAccess.productRoles;
						if(userAccess.permissions) accessObject['x-access-permissions'] = userAccess.permissions;
					}
				}
				if(accessObject['x-access-group']) req.permissions.groupAccess = accessObject['x-access-group'].split(' ');
				// not adding the rest for now since we do not need them
				if(accessObject['x-access-roles']) req.permissions.roles = accessObject['x-access-roles'].split(' ');
				if(accessObject['x-access-permissions']) req.permissions.permissions = accessObject['x-access-permissions'].split(' ');
			}
			// Root super user
			if(req.user.subject_group.prettyName === 'root') {
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
			// set core information for enforcement - for this service, we dont really care about what the token sends via org/domain/product
			// we look up the core product and ensure all the permissions match the id associated.
			const coreProduct = await helper.cacheCoreProduct(req.query.resetCache, req.user.subject_group);
			req.permissions.core = {
				group: req.permissions.sub_group,
				product: coreProduct.id || coreProduct._id,
				productCodedId: coreProduct.codedId
			};
			if(req.permissions.permissions) {
				req.permissions.permissions = req.permissions.permissions.filter((p) => {
					return (p.includes(`${req.permissions.core.productCodedId}:::`) || p.includes(`${req.permissions.core.product}:::`));
				});
			}
			if(req.permissions.roles) {
				req.permissions.roles = req.permissions.roles.filter((r) => {
					return (r.includes(`${req.permissions.core.productCodedId}::`) || r.includes(`${req.permissions.core.product}::`));
				});
			}
			if(req.permissions.groupAccess.includes('member')) {
				if(!req.permissions.permissions) req.permissions.permissions = [];
				config.MEMBER_PERMISSIONS.map((p) => {
					req.permissions.permissions.push(p.replace('member:::', `${req.permissions.core.productCodedId}:::`));
				});
				req.permissions.permissions = [...new Set(req.permissions.permissions)];
			}
			return next();
		} catch (error) {
			next(error);
		}
	},
	//todo delete
	async oldPermissions( req, res, next) {
		try {
			if(!req.user) return next();
			if(!req.authGroup) return next();
			if(req.user.initialAccessToken) return next();
			req.permissions = {
				agent: req.user,
				sub_group: req.user.subject_group.id,
				req_group: req.authGroup.id,
				enforceOwn: false,
				roles: []
			};
			if (req.user.group === req.authGroup.id) {
				req.permissions.roles.push('member');
			}
			if(req.user.subject_group.prettyName === 'root') {
				if(req.user.group === req.permissions.sub_group){
					//req.permissions.roles.super = true;
					req.permissions.roles.push('super');
				}
			}
			if(req.user.sub && req.authGroup.owner === req.user.sub) {
				//req.permissions.roles.owner = true;
				req.permissions.roles.push('owner');
			}
			if(req.user.client_credential === true) {
				req.permissions.roles.push('client');
			}
			// Plugin to capture permission claim or query external service can go here
			return next();
		} catch (error) {
			next(error);
		}
	},
	//todo delete
	oldAccess: enforce.permissionEnforce,
	access: enforce.enforce,
	async openGroupRegAuth(req, res, next) {
		try {
			if (config.OPEN_GROUP_REG === true) return next();
			return this.isAuthenticated(req, res, next);
		} catch (error) {
			next(error);
		}
	},
	async openGroupRegPermissions(req, res, next) {
		try {
			if (config.OPEN_GROUP_REG === true) return next();
			return this.permissions(req, res, next);
		} catch (error) {
			next(error);
		}
	},
	async openGroupRegAccess(req, res, next) {
		try {
			if (config.OPEN_GROUP_REG === true) return next();
			if(req.permissions && req.permissions.groupAccess && req.permissions.groupAccess.length && req.permissions.groupAccess.includes('super')) {
				return next();
			}
			throw Boom.badRequest('Public Group Registration is Disabled - Contact Admin to be Added');
		} catch (error) {
			next(error);
		}
	},
	async validateAuthGroupAllowInactive (req, res, next) {
		try {
			if (!req.params.group) throw Boom.preconditionRequired('authGroup is required');
			if (helper.protectedNames(req.params.group)) throw Boom.notFound('auth group not found');
			const result = await helper.cacheAG(req.query.resetCache, 'AG.ALT', req.params.group, false);
			req.authGroup = result;
			req.params.group = result._id;
			return next();
		} catch (error) {
			next(error);
		}
	},
	async captureAuthGroupInBody (req, res, next) {
		try {
			// assumes you've done the validation
			if (!req.params.group) throw Boom.preconditionRequired('authGroup is required');
			if (req.body) {
				req.body.authGroup = req.params.group;
			}
			return next();
		} catch (error) {
			next(error);
		}
	},
	async setGroupActivationEvent (req, res, next) {
		try {
			if (!req.authGroup) throw Boom.preconditionRequired('authGroup is required');
			if (req.authGroup.active === false) {
				// verify that owner is an email
				const pattern = /^([a-zA-Z0-9_\-\.\+]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;
				const owner = req.authGroup.owner;
				if(pattern.test(owner)) {
					// verify there are no other members
					const members = await account.getAccounts(req.authGroup._id, { $top: 1 });
					if (members.length === 0) {
						// set flag
						req.groupActivationEvent = true;
						return next();
					}
				}
			}
			return next ();
		} catch (error) {
			next(error);
		}
	},
	setNoCache(req, res, next) {
		res.set('Pragma', 'no-cache');
		res.set('Cache-Control', 'no-cache, no-store');
		next();
	},
	isAuthorizedToCreateAccount(req, res, next) {
		if(req.groupActivationEvent === true) return authorizer.isIatAuthenticatedForGroupActivation(req, res, next);
		if(req.authGroup.locked === true) return authorizer.isAuthenticated(req, res, next);
		return next();
	},
	isAuthenticatedOrIAT: authorizer.isAuthenticatedOrIATUserUpdates,
	isAuthenticated: authorizer.isAuthenticated,
	isWhitelisted: authorizer.isWhitelisted
};

export default mid;