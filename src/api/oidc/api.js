import Boom from '@hapi/boom';
import iat from './initialAccess/iat';
import oidc from './oidc';
import helper from '../../helper';
import group from '../authGroup/group';

const api = {
	async oidcCaller(req, res, next) {
		try {
			if (!req.params.group) throw Boom.notFound('Auth Group');
			if (helper.protectedNames(req.params.group)) return next();
			let tenant;
			if(!req.authGroup) {
				tenant = await group.getOneByEither(req.params.group, false);
				if(!tenant) throw Boom.notImplemented(`Group id/alias attempted was '${req.params.group}' with path: ${req.path}`);
			} else tenant = req.authGroup;
			const provider = oidc(tenant, req.customDomain);
			return provider.callback()(req, res, next);
		} catch (error) {
			next(error);
		}
	},

	async getInitialAccessToken(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide Auth Group'));
			const tenant = await group.getOneByEither(req.params.group, false);
			const expires = req.body.expires || 604800; // 7 days default
			const meta = {};
			if(req.body.email) meta.email = req.body.email;
			if(req.body.sub) meta.sub = req.body.sub;
			const response = await iat.generateIAT(expires, ['auth_group'], tenant, meta);
			return res.json(response);
		} catch (error) {
			next(error);
		}
	}
};

export default api;