import passport from 'passport';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import iat from '../api/oidc/initialAccess/iat';


passport.use('group-iat', new BearerStrategy({
        passReqToCallback: true
    },
    async (req, token, next) => {
        console.info('inside');
        try {
            const reqBody = req.body;
            const authGroupId = req.authGroup._id;
            const access = await iat.getOne(token, authGroupId);
            if(!access) return next(null, false);
            await iat.deleteOne(token, authGroupId);
            console.info('we good?');
            return next(null, true, { ...reqBody, authGroup: authGroupId });
        } catch (error) {
            console.info('oops');
            console.info(error);
            return next(error);
        }
    }
));

export default passport;