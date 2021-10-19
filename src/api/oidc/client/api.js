import Boom from '@hapi/boom';
import { say } from '../../../say';
import client from './clients';
import access from './access';
import rat from '../regAccess/rat';
import permissions from '../../../permissions';
import product from '../../products/product';
import ueEvents from '../../../events/ueEvents';

const RESOURCE = 'Clients';

const api = {
	async get(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide Auth Group');
			const result = await client.get(req.authGroup, req.query);
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getOne(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide Auth Group'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			await permissions.enforceOwn(req.permissions, req.params.id);
			const result = await client.getOne(req.authGroup, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},

	async deleteOne(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide Auth Group'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			if(req.params.id === req.authGroup.associatedClient) {
				return next(Boom.badRequest('You can not delete your Auth Group primary client'));
			}
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			const result = await client.deleteOne(req.authGroup, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},

	async clientOperations(req, res, next) {
		try {
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			await permissions.enforceOwn(req.permissions, req.params.id);
			if (!req.body.operation) return res.respond(say.noContent('Client Operation'));
			let result;
			switch (req.body.operation) {
			case 'rotate_secret':
				result = await client.rotateSecret(req.params.id, req.authGroup);
				if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
				return res.respond(say.ok(result, RESOURCE));
			case 'rotate_registration_access_token':
				result = await rat.regAccessToken(req.params.id, req.authGroup);
				if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
				return res.respond(say.ok(result, RESOURCE));
			default:
				throw Boom.badRequest('Unknown operation');
			}
		} catch (error) {
			console.info(error);
			next(error);
		}
	},
	async applyClientAccess(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.product) throw Boom.notFound('Product specified does not exist');
			if(!req.params.id) throw Boom.preconditionRequired('Id required');
			const roles = (Array.isArray(req.body.roles)) ? req.body.roles : [];
			const clientAccess = {
				product: req.product.id,
				roles
			};
			const result = await access.applyClientAccess(req.authGroup.id, req.params.id, clientAccess);
			if(result) {
				try {
					await product.addAssociatedClient(req.authGroup.id, req.product.id, req.params.id);
				} catch (error) {
					ueEvents.emit(req.authGroup.id, 'ue.client.access.error', { action: 'add product client association', error });
				}
			}
			return res.respond(say.ok(result, RESOURCE));
		} catch(error) {
			ueEvents.emit(req.authGroup.id, 'ue.client.access.error', error);
			next(error);
		}
	},
	async getClientAccess(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.params.id) throw Boom.preconditionRequired('Id required');
			const result = await access.getClientAccess(req.authGroup.id, req.params.id);
			return res.respond(say.ok(result, RESOURCE));
		} catch(error) {
			ueEvents.emit(req.authGroup.id, 'ue.client.access.error', error);
			next(error);
		}
	},
	async removeClientAccess(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.product) throw Boom.notFound('Product specified does not exist');
			if(!req.params.id) throw Boom.preconditionRequired('Id required');
			const result = await access.removeClientAccess(req.authGroup.id, req.params.id, req.product.id);
			return res.respond(say.ok(result, RESOURCE));
		} catch(error) {
			ueEvents.emit(req.authGroup.id, 'ue.client.access.error', error);
			next(error);
		}
	}
};

export default api;