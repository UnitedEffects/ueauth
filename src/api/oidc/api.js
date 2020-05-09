import Boom from '@hapi/boom';
import IAT from './models/initialAccessToken';
import iat from './initialAccess/iat';
import oidc from './oidc';
import helper from "../../helper";

const api = {
    async oidcCaller(req, res, next) {
        if (!req.params.group) return next();
        if (helper.protectedNames(req.params.group)) return next();
        const tenant = req.params.group;
        return oidc(tenant).callback(req, res, next);
    },

    async getInitialAccessToken(req, res, next) {
        try {
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide Auth Group'));
            const tenant = req.params.group;
            const expiresIn = req.body.expiresIn || 604800; // 7 days default
            const response = iat.generateIAT(expiresIn, ['auth_group', 'remove_iat'], tenant);
            return res.json(response);
        } catch (error) {
            next(error);
        }
    }
};

export default api;