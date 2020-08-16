import passport from 'passport';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import jwksClient from 'jwks-rsa';
import Boom from '@hapi/boom';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import iat from '../api/oidc/initialAccess/iat';

const config = require('../config');

const jwtCheck = /^([A-Za-z0-9\-_~+\/]+[=]{0,2})\.([A-Za-z0-9\-_~+\/]+[=]{0,2})(?:\.([A-Za-z0-9\-_~+\/]+[=]{0,2}))?$/;
function isJWT(str) {
    return jwtCheck.test(str);
}

function getUser(token, issuer) {
    return axios({
        method: 'get',
        url: `${issuer}/me`,
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
}

passport.serializeUser(function(user, done) {
    done(null, user);
});
passport.deserializeUser(function(user, done) {
    done(null, user);
});

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

passport.use('oidc', new BearerStrategy({
    passReqToCallback: true
},
    async (req, token, next) => {
        try {
            const issuer = `${config.PROTOCOL}://${config.SWAGGER}/${req.params.group}`;
            if(isJWT(token)){
                // todo autodetect from wellknown if this is a uri or the keys themselves
                const wellKnownJwksUrl = `${issuer}/jwks`;
                const client = jwksClient({
                    jwksUri: wellKnownJwksUrl
                });

                // check expiration
                function getKey(header, done) {
                    // todo, when authGroup oidc config is setup, query that for the keys instead of this
                    client.getSigningKey(header.kid, function(err, key) {
                        if(err) return done(err);
                        const signingKey = key.publicKey || key.rsaPublicKey;
                        return done(null, signingKey);
                    });
                }

                return jwt.verify(token, getKey, async (err, decoded) => {
                    if(err) {
                        console.info(err);
                        return next(null, false);
                    }
                    if(decoded) {
                        console.info(decoded);
                        try {
                            // check iss
                            if(decoded.iss !== issuer) {
                                throw Boom.unauthorized('Token issuer not recognized');
                            }
                            if(!decoded.group) {
                                //check ag
                                throw Boom.unauthorized('No Auth Group detected in token');
                            }
                            //check sub if present
                            if(decoded.sub) {
                                //todo - what if it has a sub but doesn't return user (i.e. id_token)?
                                //todo can I lookup user directly with oidc rather than using the API?
                                const user = await getUser(token, issuer);
                                if(!user || !user.data) throw Boom.unauthorized('User not recognized');
                                //check ag
                                if (!user.data.group && user.data.group !== decoded.group) {
                                    throw Boom.unauthorized('User not associated with indicated auth group');
                                }
                                const access = { ...user.data, decoded };
                                return next(null, access, { token });
                            }
                            // client_credential
                            return next(null, decoded, { token } );
                        } catch (error) {
                            return next(null, false);
                        }
                    }
                })
            }
            //todo - all of the above but when not jwt???
            //todo not jwt, try getting user info
            const user = await getUser(token, issuer);
            console.info(user);
            if(user && user.data) return next(null, user.data, { token });
            return next(null, false);
        } catch (error) {
            console.info(error);
            return next(error);
        }
    }
));

export default {
    isIatAuthenticated: passport.authenticate('iat-group', { session: false }),
    isAuthenticated: passport.authenticate('oidc', { session: false }),
};