import passport from 'passport';
import Boom from '@hapi/boom';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import iat from '../api/oidc/initialAccess/iat';

passport.use('iat-group', new BearerStrategy({
        passReqToCallback: true
    },
    async (req, token, next) => {
        try {
            if (!req.authGroup) throw Boom.preconditionFailed('Auth Group not recognized');
            if (!req.body.email) throw Boom.preconditionRequired('username is required');
            if (!req.body.password) throw Boom.preconditionRequired('password is required');
            if (req.body.email !== req.authGroup.owner) throw Boom.preconditionFailed('Activating account email must match new auth group owner email');
            const reqBody = req.body;
            const authGroupId = req.authGroup._id;
            const access = await iat.getOne(token, authGroupId);
            if(!access) return next(null, false);
            return next(null, true, { ...reqBody, authGroup: authGroupId, token: access });
        } catch (error) {
            return next(error);
        }
    }
));


export default {
    isIatAuthenticated: passport.authenticate('iat-group', { session: false })
};