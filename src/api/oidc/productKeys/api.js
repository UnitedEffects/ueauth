import clientAccess from '../client/access';
import product from '../../products/product';
import Boom from '@hapi/boom';
import key from './keys';
import {say} from '../../../say';
import ueEvents from '../../../events/ueEvents';
import helper from '../../../helper';

const RESOURCE = 'Product Keys';

export default {
	async initializeProductKeyClient(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.product) throw Boom.preconditionRequired('Product required');
			if(req.permissions.enforceOwn) {
				if(!req.permissions?.orgContext) throw Boom.forbidden('Org Context required with your permission');
				req.body.organizationId = req.permissions.orgContext;
				if(!req.permissions.products.includes(req.product.id)) throw Boom.forbidden(`Product ${req.product.id}`);
			}
			let roles;
			if(req.body.roles && Array.isArray(req.body.roles)) {
				roles = req.body.roles;
			}
			delete req.body.roles;
			const data = {
				productId: req.product.id,
				...req.body
			};
			const result = await key.initializeProductKeyClient(req.authGroup, req.product.name, data);
			if(!result?.clientId) {
				throw Boom.expectationFailed('There was an unexpected error, please try again later or contact the admin');
			}
			await product.addAssociatedClient(req.authGroup.id, req.product.id, result.clientId);
			if(roles) {
				await clientAccess.applyClientAccess(req.authGroup.id, result.clientId, { roles, product: req.product.id });
				result.roles = roles;
			}
			return res.respond(say.created(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.key.access.error', error);
			next(error);
		}
	},
	async removeProductKeyClient(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.product) throw Boom.preconditionRequired('Product required');
			if(!req.params.clientId) throw Boom.badRequest('Must specify the ID of the client');
			let orgContext;
			if(req.permissions.enforceOwn) {
				if(!req.permissions?.orgContext) throw Boom.forbidden('Org Context required with your permission');
				orgContext = req.permissions.orgContext;
			}
			const result = await key.removeProductKeyClient(req.authGroup.id, req.product.id, req.params.clientId, orgContext);
			if(!result) throw Boom.notFound(req.params.clientId);
			await product.removeAssociatedClient(req.authGroup.id, req.product.id, req.params.clientId);
			return res.respond(say.ok({
				authGroup: req.authGroup.id,
				clientId: req.params.clientId,
				productId: req.product.id
			}, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.key.access.error', error);
			next(error);
		}
	},
	async showProductKeyClients(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.product) throw Boom.preconditionRequired('Product required');
			const query = await helper.parseOdataQuery(req.query);
			if(req.permissions.enforceOwn) {
				if(!query.query.organizationId) throw Boom.forbidden('You must specify exactly one organization');
				if(!req.permissions.organizations.includes(query.query.organizationId)) {
					throw Boom.forbidden(`Org ${query.query.organizationId}`);
				}
			}
			const result = await key.showProductKeyClients(req.authGroup, req.product.id, query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async updateProductKeyClientRoles(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.product) throw Boom.preconditionRequired('Product required');
			if(!req.params.clientId) throw Boom.badRequest('Must specify the ID of the client');
			if(!req.body.roles || !Array.isArray(req.body.roles)) throw Boom.badRequest('Must specify new roles as an array');
			let accessArgs = {
				'payload.associated_product': req.product.id
			};
			if(req.permissions.enforceOwn) {
				if(!req.permissions?.orgContext) throw Boom.forbidden('Org Context required with your permission');
				accessArgs['payload.initialized_org_context'] = req.permissions.orgContext;
			}
			const result = await clientAccess.applyClientAccess(req.authGroup.id, req.params.clientId, { roles: req.body.roles, product: req.product.id }, accessArgs);
			if(!result) throw Boom.notFound(req.params.clientId);
			const output = {
				authGroup: result.authGroup,
				clientId: result.id,
				productId: result.access.product,
				roles: result.access.roles
			};
			ueEvents.emit(req.authGroup.id, 'ue.key.access.update', output);
			return res.respond(say.ok(output, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.key.access.error', error);
			next(error);
		}
	},
	async createKey(req, res, next) {
		try {
			//todo enforce own...
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.product) throw Boom.preconditionRequired('Product required');
			if(!req.body.clientId) throw Boom.badRequest('Client Id required');
			const data = {
				...req.body,
				createdBy: req.user.sub || req.user.id,
				modifiedBy: req.user.sub || req.user.id
			};
			if(!data.expires) data.expires = 2592000;
			const result = await key.createKey(req.authGroup, req.product.id, data);
			const token = result.key;
			const exp = new Date(result.createdAt);
			exp.setSeconds(exp.getSeconds() + result.expires);
			const expiresOn = exp;
			const output = {
				key: token,
				expiresOn,
				...(JSON.parse(JSON.stringify(result))),
			};
			return res.respond(say.created(output, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.key.access.error', error);
			next(error);
		}
	},
	async getKeys(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.product) throw Boom.preconditionRequired('Product required');
			//todo enforce own...
			const result = await key.getKeys(req.authGroup.id, req.product.id, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getKey(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.product) throw Boom.preconditionRequired('Product required');
			if(!req.params.id) throw Boom.badRequest('ID required');
			//todo enforce own...
			const result = await key.getKey(req.authGroup.id, req.product.id, req.params.id);
			if(!result) throw Boom.notFound(req.params.id);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async removeKey(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.product) throw Boom.preconditionRequired('Product required');
			if(!req.params.id) throw Boom.badRequest('ID required');
			//todo enforce own...
			const result = await key.removeKey(req.authGroup.id, req.product.id, req.params.id);
			if(!result) throw Boom.notFound(req.params.id);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.key.access.error', error);
			next(error);
		}
	},
	async refreshKey(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.product) throw Boom.preconditionRequired('Product required');
			if(!req.params.id) throw Boom.badRequest('ID required');
			//todo enforce own...
			const result = await key.refreshKey(req.authGroup, req.product.id, req.params.id);
			if(!result) throw Boom.notFound(req.params.id);
			const token = result.key;
			const exp = new Date(result.createdAt);
			exp.setSeconds(exp.getSeconds() + result.expires);
			const expiresOn = exp;
			const output = {
				key: token,
				expiresOn,
				...(JSON.parse(JSON.stringify(result))),
			};
			return res.respond(say.ok(output, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.key.access.error', error);
			next(error);
		}
	},
};