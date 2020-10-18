import Boom from '@hapi/boom';
import iat from './initialAccess/iat';
import oidc from './oidc';
import helper from '../../helper';
import group from '../authGroup/group';

const api = {
    async oidcCaller(req, res, next) {
        if (!req.params.group) return next();
        if (helper.protectedNames(req.params.group)) return next();
        const tenant = await group.getOneByEither(req.params.group, false);
        return oidc(tenant).callback(req, res, next);
    },

    async getInitialAccessToken(req, res, next) {
        try {
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide Auth Group'));
            const tenant = await group.getOneByEither(req.params.group, false);
            const expiresIn = req.body.expiresIn || 604800; // 7 days default
            const response = await iat.generateIAT(expiresIn, ['auth_group'], tenant);
            return res.json(response);
        } catch (error) {
            next(error);
        }
    }
};

export default api;