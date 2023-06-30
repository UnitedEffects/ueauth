import oidc from '../oidc';
import authgroup from '../../authGroup/group';
import Boom from '@hapi/boom';
import key from './keys';
import {say} from '../../../say';
import ueEvents from '../../../events/ueEvents';

const RESOURCE = 'Product Keys';

export default {
	async initializeProductKeyClient(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.product) throw Boom.notFound('Product specified does not exist');
			//todo enforce own... also core=true?
			const result = await key.initializeProductKeyClient(req.authGroup, req.product, req.body);
			return res.respond(say.created(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.key.access.error', error);
			next(error);
		}
	},
	async removeProductKeyClient(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.product) throw Boom.notFound('Product specified does not exist');
			if(!req.params.id) throw Boom.badRequest('Must specify the ID of the client');
			//todo enforce own...
			const result = await key.removeProductKeyClient(req.authGroup, req.product, req.params.id);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.key.access.error', error);
			next(error);
		}
	},
	async showProductKeyClients(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('AuthGroup required');
			if(!req.product) throw Boom.notFound('Product specified does not exist');
			//todo enforce own...
			// todo filters...
			const result = await key.showProductKeyClients(req.authGroup, req.product);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async createKey(req, res, next) {
		try {
			//todo
			//todo enforce own...
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.key.access.error', error);
			next(error);
		}
	},
	async getKeys(req, res, next) {
		try {
			//todo
			//todo enforce own...
		} catch (error) {
			next(error);
		}
	},
	async getKey(req, res, next) {
		try {
			//todo
			//todo enforce own...
		} catch (error) {
			next(error);
		}
	},
	async refreshKey(req, res, next) {
		try {
			//todo
			//todo enforce own...
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.key.access.error', error);
			next(error);
		}
	},
	async removeKey(req, res, next) {
		try {
			//todo
			//todo enforce own...
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.key.access.error', error);
			next(error);
		}
	},

	/**
	 * This is a temporary function to work out the flow. This will be deleted shortly.
	 * @returns {Promise<void>}
	 */
	async defineToken (authGroup, organization, clientId, exp) {
		const ag = await authgroup.getOne(authGroup);
		const provider = new oidc(ag);
		const client = await provider.Client.find(clientId);
		const token = new provider.ClientCredentials({
			client,
			expiresIn: exp,
			scope: `access group:${authGroup} org:${organization}`
		});
		await token.save();
		console.info('post-save', token);
	}
};