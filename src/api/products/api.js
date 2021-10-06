import Boom from '@hapi/boom';
import { say } from '../../say';
import prod from './product';
import perms from '../permissions/permissions';
import permissions from '../../permissions';
import ueEvents from '../../events/ueEvents';

const RESOURCE = 'Product';

const api = {
	async writeProduct(req, res, next) {
		try {
			if (!req.authGroup) throw Boom.badRequest('AuthGroup not defined');
			if (req.authGroup.active === false) throw Boom.forbidden('You can not add orgs to an inactive group');
			if (req.permissions.enforceOwn === true) throw Boom.forbidden();
			if (req.user && req.user.sub) {
				req.body.createdBy = req.user.sub;
				req.body.modifiedBy = req.user.sub;
			}
			req.body.authGroup = req.authGroup.id;
			const result = await prod.writeProduct(req.body);
			return res.respond(say.created(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.product.error', error);
			next(error);
		}
	},
	async getProducts(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			const result = await prod.getProducts(req.authGroup.id || req.authGroup._id, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getProduct(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			await permissions.enforceOwnProduct(req.permissions, req.params.id);
			const result = await prod.getProduct(req.authGroup.id || req.authGroup._id, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async patchProduct(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			await permissions.enforceOwnProduct(req.permissions, req.params.id);
			const result = await prod.patchProduct(req.authGroup, req.params.id, req.body, req.user.sub || req.user.id || 'SYSTEM');
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.product.error', error);
			next(error);
		}
	},
	async deleteProduct(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			await permissions.enforceOwnProduct(req.permissions, req.params.id);
			const permissions = await perms.deletePermissionsByProduct(req.authGroup.id, req.params.id);
			const result = await prod.deleteProduct(req.authGroup.id || req.authGroup._id, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			const output = {
				permissionsDeleted: permissions.deletedCount,
				product: result
			};
			return res.respond(say.ok(output, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.product.error', error);
			next(error);
		}
	},
	async checkForPermissions(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.product) throw Boom.preconditionRequired('You need to specify a product');
			const result = await perms.checkForProductReference(req.authGroup.id, req.product.id);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	}
};

export default api;