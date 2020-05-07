import Boom from '@hapi/boom';
import IAT from './models/initialAccessToken';
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
            let response;
            new (oidc(tenant).InitialAccessToken)({ expiresIn: 1800, policies: ['auth_group', 'remove_iat'] }).save().then(async (x) => {
                const iat = await IAT.findOneAndUpdate( { _id: x }, { 'payload.auth_group': req.params.group }, {new: true});
                response = JSON.parse(JSON.stringify(iat.payload));
                delete response.auth_group;
                delete response.policies;
                return res.json(response);
            });
        } catch (error) {
            next(error);
        }
    }
};

export default api;