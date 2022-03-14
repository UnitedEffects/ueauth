import Boom from '@hapi/boom';
import { say } from '../../say';
import perm from './permissions';
import permissions from '../../permissions';
import roles from '../roles/roles';
import ueEvents from '../../events/ueEvents';

const RESOURCE = 'Permissions';

const api = {
	async writePermission(req, res, next) {
		try {
			if (req.authGroup.active === false) throw Boom.forbidden('You can not add roles in an inactive group');
			if (!req.product) throw Boom.forbidden('Roles must be associated to one product');
			if (req.permissions.enforceOwn === true) throw Boom.forbidden();
			if (req.product.core === true) {
				// ensure only root users can add permissions to core products
				await permissions.enforceRoot(req.permissions);
			}
			if (req.user && req.user.sub) {
				req.body.createdBy = req.user.sub;
				req.body.modifiedBy = req.user.sub;
			}
			req.body.product = req.product.id;
			req.body.authGroup = req.authGroup.id;
			const result = await perm.writePermission(req.body);
			return res.respond(say.created(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.permission.error', error);
			next(error);
		}
	},
	async getPermissions(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.forbidden('Permission must be associated to one product');
			await permissions.enforceOwnProduct(req.permissions, req.product.id);
			const result = await perm.getPermissions(req.authGroup.id, req.product.id, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getPermission(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.forbidden('Permission must be associated to one product');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			await permissions.enforceOwnProduct(req.permissions, req.product.id);
			const result = await perm.getPermission(req.authGroup.id, req.product.id, req.params.id);
			if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getOrgPermission(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.forbidden('Permission must be associated to one product');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			if (!req.organization) throw Boom.preconditionRequired('Must provide an org context');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			if(!req.organization.associatedProducts.includes(req.product.id)) throw Boom.notFound(`Product: ${req.product.id}`);
			await permissions.enforceOwnProduct(req.permissions, req.product.id);
			const result = await perm.getPermission(req.authGroup.id, req.product.id, req.params.id);
			if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getOrgPermissions(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.preconditionRequired('Permission must be associated to one product');
			if (!req.organization) throw Boom.preconditionRequired('Must provide an org context');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			if(!req.organization.associatedProducts.includes(req.product.id)) throw Boom.notFound(`Product: ${req.product.id}`);
			await permissions.enforceOwnProduct(req.permissions, req.product.id);
			const result = await perm.getPermissions(req.authGroup.id, req.product.id, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async deletePermission(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.forbidden('Permission must be associated to one product');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			if (req.permissions.enforceOwn === true) throw Boom.forbidden();
			if (req.product.core === true) {
				// ensure only root users remove permissions from core products
				await permissions.enforceRoot(req.permissions);
			}
			const permission = await perm.getPermission(req.authGroup.id, req.product.id, req.params.id);
			if(permission.core === true) {
				await permissions.enforceRoot(req.permissions);
			}
			const result = await perm.deletePermission(req.authGroup.id, req.product.id, req.params.id);
			if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.permission.error', error);
			next(error);
		}
	},
	async bulkDelete(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.forbidden('Permission must be associated to one product');
			if(!Array.isArray(req.body)) throw Boom.preconditionRequired('Must provide id array');
			if (req.permissions.enforceOwn === true) throw Boom.forbidden();
			if (req.product.core === true) {
				// ensure only root users remove permissions from core products
				await permissions.enforceRoot(req.permissions);
			}
			const result = await perm.bulkDelete(req.authGroup.id, req.product.id, req.body);
			if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.permission.error', error);
			next(error);
		}
	},
	async checkForRoles(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.forbidden('Permission must be associated to one product');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			if (req.permissions.enforceOwn === true) throw Boom.forbidden();
			const permission = await perm.getPermission(req.authGroup.id, req.product.id, req.params.id);
			const result = await roles.checkForPermissions(req.authGroup.id, req.product.id, `${permission.id} ${permission.coded}`);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	getTargetsOrActions(meta) {
		return async function (req, res, next) {
			try {
				if (!req.authGroup) throw Boom.preconditionRequired('Must provide authGroup');
				if (!req.product) throw Boom.forbidden('Permission must be associated to one product');
				if (req.permissions.enforceOwn === true) throw Boom.forbidden();
				const result = await perm.getTargetsOrActions(meta, req.authGroup.id, req.product.id);
				return res.respond(say.ok(result, RESOURCE));
			} catch (error) {
				next(error);
			}
		};
	},
	async getTags(req, res, next) {
		try {
			if (!req.authGroup) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.forbidden('Permission must be associated to one product');
			if (req.permissions.enforceOwn === true) throw Boom.forbidden();
			const result = await perm.getTags(req.authGroup.id, req.product.id);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	}
};

export default api;