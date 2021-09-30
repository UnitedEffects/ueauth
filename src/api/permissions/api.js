import Boom from '@hapi/boom';
import { say } from '../../say';
import perm from './permissions';
import ueEvents from '../../events/ueEvents';

const RESOURCE = 'Permissions';

const api = {
	async writePermission(req, res, next) {
		try {
			if (req.authGroup.active === false) throw Boom.forbidden('You can not add roles in an inactive group');
			if (!req.product) throw Boom.forbidden('Roles must be associated to one product');
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
			//todo access?
			const result = await perm.getPermission(req.authGroup.id, req.product.id, req.params.id);
			if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
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
			// todo access?
			const result = await perm.deletePermission(req.authGroup.id, req.product.id, req.params.id);
			if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.permission.error', error);
			next(error);
		}
	},
};

export default api;