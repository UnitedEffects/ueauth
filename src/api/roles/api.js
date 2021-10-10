import Boom from '@hapi/boom';
import { say } from '../../say';
import role from './roles';
import permissions from '../../permissions';
import ueEvents from '../../events/ueEvents';

const RESOURCE = 'Role';

const api = {
	// todo - make sure this is only those products associated to the org (so not ALL products)
	async getAllRolesAcrossProductsByOrg (req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must provide organization');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			const result = await role.getAllRolesAcrossProductsByOrg(req.authGroup.id, req.organization.id, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getAllRoles (req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			const result = await role.getAllRoles(req.authGroup.id, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	// todo - make sure this returns all global roles + roles for this org
	async getOrganizationRoles(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.forbidden('Roles must be associated to one product');
			if (!req.organization) throw Boom.forbidden('Custom roles must be associated to one organization');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			await permissions.enforceOwnProduct(req.permissions, req.product.id);
			const result = await role.getOrganizationRoles(req.authGroup.id, req.product.id, req.organization.id, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	// role scoped to the organization
	async writeCustom(req, res, next) {
		try {
			if (req.authGroup.active === false) throw Boom.forbidden('You can not add roles in an inactive group');
			if (!req.product) throw Boom.forbidden('Roles must be associated to one product');
			if (!req.organization) throw Boom.forbidden('Custom roles must be associated to one organization');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			await permissions.enforceOwnProduct(req.permissions, req.product.id);
			if (req.user && req.user.sub) {
				req.body.createdBy = req.user.sub;
				req.body.modifiedBy = req.user.sub;
			}
			req.body.product = req.product.id;
			req.body.productCodedId = req.product.codedId;
			req.body.organization = req.organization.id;
			req.body.authGroup = req.authGroup.id;
			const result = await role.writeCustomRole(req.body);
			return res.respond(say.created(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.role.error', error);
			next(error);
		}
	},
	// role scoped to authgroup
	async writeRole(req, res, next) {
		try {
			if(req.authGroup.active === false) throw Boom.forbidden('You can not add roles in an inactive group');
			if(!req.product) throw Boom.forbidden('Roles must be associated to one product');
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			if (req.user && req.user.sub) {
				req.body.createdBy = req.user.sub;
				req.body.modifiedBy = req.user.sub;
			}
			req.body.product = req.product.id;
			req.body.productCodedId = req.product.codedId;
			req.body.authGroup = req.authGroup.id;
			const result = await role.writeRole(req.body);
			return res.respond(say.created(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.role.error', error);
			next(error);
		}
	},
	async getRoles(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.product) throw Boom.forbidden('Roles must be associated to one product');
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			const result = await role.getRoles(req.authGroup.id, req.product.id, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getRole(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.forbidden('Roles must be associated to one product');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			const result = await role.getRole(req.authGroup.id, req.product.id, req.params.id);
			if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async patchRole(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.forbidden('Roles must be associated to one product');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			const thisRole = await role.getRole(req.authGroup.id, req.product.id, req.params.id);
			if(thisRole.core === true) await permissions.enforceRoot(req.permissions);
			const result = await role.patchRole(req.authGroup, thisRole, req.params.id, req.product.id, req.body, req.user.sub || req.user.id || 'SYSTEM');
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.role.error', error);
			next(error);
		}
	},
	async deleteRole(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.forbidden('Roles must be associated to one product');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			const thisRole = await role.getRole(req.authGroup.id, req.product.id, req.params.id);
			if(thisRole.core === true) await permissions.enforceRoot(req.permissions);
			const result = await role.deleteRole(req.authGroup.id, req.product.id, req.params.id);
			if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.role.error', error);
			next(error);
		}
	},
	async getOrganizationRole(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.forbidden('Roles must be associated to one product');
			if (!req.organization) throw Boom.forbidden('Roles must be associated to an organization');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			await permissions.enforceOwnProduct(req.permissions, req.product.id);
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			const result = await role.getRoleByOrgProdId(req.authGroup.id, req.product.id, req.organization.id, req.params.id);
			if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async deleteOrganizationRole(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.forbidden('Roles must be associated to one product');
			if (!req.organization) throw Boom.forbidden('Roles must be associated to an organization');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			await permissions.enforceOwnProduct(req.permissions, req.product.id);
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			const result = await role.deleteRoleByOrgProdId(req.authGroup.id, req.product.id, req.organization.id, req.params.id);
			if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async patchOrganizationRole(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if (!req.product) throw Boom.forbidden('Roles must be associated to one product');
			if (!req.organization) throw Boom.forbidden('Roles must be associated to your organization');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			await permissions.enforceOwnProduct(req.permissions, req.product.id);
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			const thisRole = await role.getRoleByOrgProdId(req.authGroup.id, req.product.id, req.organization.id, req.params.id);
			const result = await role.patchOrganizationRole(req.authGroup, thisRole, req.params.id, req.organization.id, req.product.id, req.body, req.user.sub || req.user.id || 'SYSTEM');
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.role.error', error);
			next(error);
		}
	}
};

export default api;