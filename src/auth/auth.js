import passport from 'passport';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import jwksClient from 'jwks-rsa';
import Boom from '@hapi/boom';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import iat from '../api/oidc/initialAccess/iat';
import cl from '../api/oidc/client/clients';
import oidc from '../api/oidc/oidc';

const config = require('../config');

const jwtCheck = /^([A-Za-z0-9\-_~+\/]+[=]{0,2})\.([A-Za-z0-9\-_~+\/]+[=]{0,2})(?:\.([A-Za-z0-9\-_~+\/]+[=]{0,2}))?$/;
function isJWT(str) {
    return jwtCheck.test(str);
}

async function getUser(token, issuer) {
    return axios({
        method: 'get',
        url: `${issuer}/me`,
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
}

async function introspect(token, issuer, client) {
    try {
        //todo can this be done directly with OIDC?
        const c = JSON.parse(JSON.stringify(client));
        const creds = `${c.client_id}:${c.client_secret}`;
        const encoded = Buffer.from(creds).toString('base64');
        return axios({
            method: 'post',
            url: `${issuer}/token/introspection`,
            data: `token=${token}`,
            headers: {
                'Authorization': `Basic ${encoded}`,
                'Content-Type': 'application/x-www-form-urlencoded'
        }
        });
    } catch (error) {
        throw error;
    }
}

async function runDecodedChecks(token, issuer, decoded, authGroup) {
    if(decoded.iss !== issuer) {
        // check iss
        throw Boom.unauthorized('Token issuer not recognized');
    }
    if(!decoded.group) {
        //check auth group exists
        throw Boom.unauthorized('No Auth Group detected in token');
    }
    if(decoded.group !== authGroup._id) {
        // check auth group matches
        throw Boom.unauthorized('Auth Group does not match');
    }
    if(typeof decoded.aud === "string") {
        if(decoded.aud !== authGroup.associatedClient) {
            // check audience = client
            throw Boom.unauthorized('Token audience not specific to this auth group client');
        }
    }
    if(typeof decoded.aud === "object") {
        if(!decoded.aud.includes(authGroup.associatedClient)) {
            // check audience = client
            throw Boom.unauthorized('Token audience not specific to this auth group client');
        }
    }
    if(decoded.azp) {
        // client credential issuing client - azp
        if(decoded.azp !== authGroup.associatedClient) {
            throw Boom.unauthorized('Client Credential token not issued by group associated client');
        }
    }
    //check sub if present
    if(decoded.sub && decoded.scope) {
        //todo can I lookup user directly with oidc rather than using the API?
        //WIP - need to figure out how to do this and respect scope...
        const testing = await oidc(authGroup.id).Account.findAccount({authGroup}, decoded.sub, token)
        console.info(oidc(authGroup.id).issuer);
        console.info('test');
        console.info(await testing.claims());
        //--------^^^^^^^^^^^^^^^^^
        const user = await getUser(token, issuer);
        if(!user || !user.data) throw Boom.unauthorized('User not recognized');
        //check ag
        if (!user.data.group && user.data.group !== decoded.group) {
            throw Boom.unauthorized('User not associated with indicated auth group');
        }
        return { ...user.data, decoded };
    }
    if(decoded.sub && !decoded.scope) {
        //id_token
        throw Boom.unauthorized('API Access requires the access-token not the id-token');
    }
    // client_credential - note, permissions may still stop the request
    return decoded
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
            if (req.authGroup.active === true) return next(null, true);
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
            /*
            1. use oidc lib to get user instead of /me API ?
            2. use oidc for programmatic introspection?
            3. skip wellknown and get keys from group lookup (after implementing that)
             */
            const issuer = `${config.PROTOCOL}://${config.SWAGGER}/${req.authGroup.prettyName}`;
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
                        console.error(err);
                        return next(null, false);
                    }
                    if(decoded) {
                        try {
                            const result = await runDecodedChecks(token, issuer, decoded, req.authGroup);
                            return next(null, result, { token })
                        } catch (error) {
                            console.error(error);
                            return next(null, false);
                        }
                    }
                })
            }
            //opaque token
            const client = await cl.getOneFull(req.authGroup, req.authGroup.associatedClient);
            const inspect = await introspect(token, issuer, client.payload);
            if(inspect && inspect.data) {
                if (inspect.data.active === false) return next(null, false);
                try {
                    const result = await runDecodedChecks(token, issuer, inspect.data, req.authGroup);
                    return next(null, result, { token })
                } catch (error) {
                    console.error(error);
                    return next(null, false);
                }
            }
            return next(null, false);
        } catch (error) {
            console.error(error);
            return next(null, false);
        }
    }
));

export default {
    isIatAuthenticated: passport.authenticate('iat-group', { session: false }),
    isAuthenticated: passport.authenticate('oidc', { session: false }),
};