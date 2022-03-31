import { OpenApiValidator } from 'express-openapi-validate';
import Boom from '@hapi/boom';
import { v4 as uuid } from 'uuid';
import handleErrors from './customErrorHandler';
import { sayMiddleware } from './say';
import authorizer from './auth/auth';
import helper from './helper';
import group from './api/authGroup/group';
import orgs from './api/orgs/orgs';
import doms from './api/domains/domain';
import product from './api/products/product';
import account from './api/accounts/account';
import access from './permissions';
import mongoose from 'mongoose';
import swag from './swagger';
import plugins from './api/plugins/plugins';

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
	async requestId(req, res, next) {
		try {
			if(req.requestId) return next();
			// try mapping from gateway if the request is missing...
			if(req.headers['x-request-id']) {
				req.requestId = req.headers['x-request-id'];
				return next();
			}
			// create our own
			req.requestId = uuid();
			return next();
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
			const error = await handleErrors.parse(err, req.requestId);
			if(!req.path.includes('/api')) {
				if(req.headers && req.headers.accept && !req.headers.accept.split(',').includes('application/json')) {
					let data = {};
					if(req.authGroup) {
						const { authGroup, safeAG } = await group.safeAuthGroup(req.authGroup);
						data.authGroup = safeAG;
						data.authGroupLogo = authGroup.config?.ui?.skin?.logo;
					}
					if(error.statusCode === 404) {
						data = {
							...data,
							title: 'Not sure what you\'re looking for...',
							message: 'But, it looks like you may have gone to a bad URL',
							details: Object.entries(error).map(([key, value]) => `<p><strong>${key}</strong>: ${value}</p>`).join('')
						};
						return res.render('response/response', data);
					}
					data = {
						...data,
						title: 'oops! something went wrong',
						message: error.message, details: error.error
					};
					return res.render('response/response', data);
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
			// translating express path syntax to openApi syntax
			await Promise.all(Object.keys(req.params).map((p)=>{
				path = path.replace(`:${p}`, `{${p}}`);
				return p;
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
	async validateHostDomain (req, res, next) {
		try {
			if(req.hostname === config.SWAGGER.split(':')[0]) return next();
			req.customDomain = undefined;
			req.customDomainUI = undefined;
			const AG = await group.findByAliasDNS(req.hostname);
			if(!AG) throw Boom.notFound(`DNS not recognized - ${req.hostname}`);
			req.customDomain = req.hostname;
			req.customDomainUI = AG.aliasDnsUi;
			req.authGroup = AG;
			req.params.group = AG._id || AG.id;
			next();
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
			req.ogPathGroup = req.params.group;
			req.params.group = result._id || result.id;
			req.customDomain = undefined;
			req.customDomainUI = undefined;
			if(req.hostname !== config.SWAGGER.split(':')[0]) {
				if(req.authGroup.aliasDnsOIDC !== req.hostname) throw Boom.notFound(`DNS not recognized - ${req.hostname}`);
				req.customDomain = req.hostname;
				req.customDomainUI = req.authGroup.aliasDnsUi;
			}
			// adding organization context for secure API calls into this... may find a better home later
			return mid.organizationContext(req, res, next);
		} catch (error) {
			console.error(error);
			next(Boom.notFound(error.message || 'Auth Group'));
		}
	},
	async organizationContext(req, res, next) {
		try {
			const ogPath = req.ogPathGroup || req.params.group || undefined;
			if(!req.orgContext) {
				req.orgContext = {
					id: 'member'
				};
			}
			// skip if this is a group activation event
			if(req.groupActivationEvent === true) return next();
			// skip this if its just a swagger request
			if(req.path.includes('swagger')) return next();
			const primaryOrg = await helper.cachePrimaryOrg(req.query.resetCache, req.authGroup);
			if(!primaryOrg) throw Boom.notFound('AuthGroup missing primary organization');
			req.primaryOrg = primaryOrg;
			if(ogPath && req.params && req.params.id && req.path === `/${ogPath}/organizations/${req.params.id}`){
				const orgCon = await orgs.getOrg(req.params.group, req.params.id);
				if(orgCon) req.orgContext = orgCon;
				return next();
			}
			if(req.params.group && req.params && req.params.org) {
				const orgCon = await orgs.getOrg(req.params.group, req.params.org);
				if(orgCon) req.orgContext = orgCon;
				return next();
			}
			if(req.authGroup) {
				req.orgContext = primaryOrg;
				return next();
			}
			return next();
		} catch (error) {
			console.error(error);
			next(Boom.notFound(error.message || 'Organization Context'));
		}
	},
	async validateOrganization (req, res, next) {
		try {
			if (!req.params.org) throw Boom.preconditionRequired('organization ID is required');
			if (!req.authGroup) throw Boom.preconditionRequired('AuthGroup is required');
			if (req.orgContext) {
				if(req.orgContext.id === req.params.org) req.organization = req.orgContext;
				return next();
			}
			req.organization = await orgs.getOrg(req.authGroup.id, req.params.org);
			return next();
		} catch (error) {
			next(error);
		}
	},
	async validateDomain (req, res, next) {
		try {
			if (!req.params.domain) throw Boom.preconditionRequired('organization ID is required');
			if (!req.authGroup) throw Boom.preconditionRequired('AuthGroup is required');
			if (!req.organization) throw Boom.preconditionRequired('Organization context required');
			req.domain = await doms.getDomain(req.authGroup.id, req.organization.id, req.params.domain);
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
	async openGroupRegAuth(req, res, next) {
		try {
			if (config.OPEN_GROUP_REG === true) return next();
			return mid.isAuthenticated(req, res, next);
		} catch (error) {
			next(error);
		}
	},
	async openGroupRegPermissions(req, res, next) {
		try {
			if (config.OPEN_GROUP_REG === true) return next();
			return mid.permissions(req, res, next);
		} catch (error) {
			next(error);
		}
	},
	async openGroupRegAccess(req, res, next) {
		try {
			if (config.OPEN_GROUP_REG === true) return next();
			return mid.access('group')(req, res, next);
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
			req.ogPathGroup = req.params.group;
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
		req.accountCreationRequest = true;
		return next();
	},
	// permissions and roles
	async pubOrContext(req, res,next) {
		if(!req.user) return next();
		else {
			return mid.organizationContext(req, res, next);
		}
	},
	async pubOrPermissions (req, res, next) {
		if(!req.user) return next();
		else {
			return access.permissions(req, res, next);
		}
	},
	permissions: access.permissions,
	access: access.enforce,
	setRoleTarget: access.setRoleTarget,
	enforceRole: access.enforceRole,
	// authorization
	isAuthenticatedOrIAT: authorizer.isAuthenticatedOrIATUserUpdates,
	iatQueryCodeAuth: authorizer.iatQueryCodeAuth,
	isAuthenticated: authorizer.isAuthenticated,
	isOIDCValid: authorizer.isOIDCValid,
	isBasic: authorizer.isBasic,
	isSimpleIAT: authorizer.isSimpleIAT,
	isAccessOrSimpleIAT: authorizer.isAccessOrSimpleIAT,
	isWhitelisted: authorizer.isWhitelisted,
	isPublicOrAuth: authorizer.publicOrAuth
};

export default mid;