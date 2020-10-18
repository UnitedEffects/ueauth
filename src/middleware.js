import { OpenApiValidator } from 'express-openapi-validate';
import Boom from '@hapi/boom';
import handleErrors from './customErrorHandler';
import { sayMiddleware } from './say';
import authorizer from './auth/auth';
import helper from './helper';
import group from './api/authGroup/group';
import account from './api/accounts/account';
import swag from './swagger';

const config = require('./config');

const schema = new OpenApiValidator(swag);

const mid = {
    cores (req, res, next) {
        try {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, DELETE, PUT, PATCH, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, api_key, Authorization');
            next();
        } catch (error) {
            next(error);
        }

    },
    catch404 (req, res, next) {
        try {
            next(handleErrors.catch404());
        } catch (error) {
            next(error);
        }
    },
    async catchErrors (err, req, res, next) {
        try {
            if(config.ENV !== 'production') console.info(err);
            const error = await handleErrors.parse(err);
            return res.respond(error);
        } catch (error) {
            console.info('MIDDLEWARE - ERROR HANDLER ISSUE');
            console.info(error);
        }
    },
    responseIntercept: sayMiddleware.responseIntercept,
    async schemaCheck(req, res, next) {
        try {
            let path  = req.route.path;
            await Promise.all(Object.keys(req.params).map((p)=>{
                path = path.replace(`:${p}`, `{${p}}`);
            }));
            return schema.validate(req.method.toString().toLowerCase(), path.toLowerCase())(req, res, next);
        } catch (error) {
            next(Boom.expectationFailed('OpenAPI Schema Validation'));
        }
    },
    async validateAuthGroup (req, res, next) {
        try {
            console.info('authGroup middleware validation called');
            if (!req.params.group) throw Boom.preconditionRequired('authGroup is required');
            if (helper.protectedNames(req.params.group)) throw Boom.notFound('auth group not found');
            const result = await group.getOneByEither(req.params.group);
            if (!result) throw Boom.notFound('auth group not found');
            req.authGroup = result;
            req.params.group = result._id;
            return next();
        } catch (error) {
            next(error);
        }
    },
    async permissions( req, res, next) {
        try {
            if(req.user && req.user.sub) {
                req.permissions = {
                    user: req.user,
                    owner: false
                };
                if(req.authGroup.owner === req.user.sub) {
                    req.permissions.owner = true;
                }
            }
            return next();
        } catch (error) {
            next(error);
        }
    },
    async access( req, res, next) {
        try {
            //todo will have to make this cofigurable and robust later
            if (!req.permissions || req.permissions.owner !== true) {
                //validate access rules here...
                //will need to be able to validate by resource...

                throw Boom.forbidden('You do not have the right permissions');
            }

            return next();
        } catch (error) {
            next(error);
        }
    },
    async validateAuthGroupAllowInactive (req, res, next) {
        try {
            if (!req.params.group) throw Boom.preconditionRequired('authGroup is required');
            if (helper.protectedNames(req.params.group)) throw Boom.notFound('auth group not found');
            const result = await group.getOneByEither(req.params.group, false);
            if (!result) throw Boom.notFound('auth group not found');
            req.authGroup = result;
            req.params.group = result._id;
            return next();
        } catch (error) {
            next(error);
        }
    },
    async captureAuthGroupInBody (req, res, next) {
        try {
            // assumes you've done the validation
            if (!req.params.group) throw Boom.preconditionRequired('authGroup is required');
            if (req.body) {
                req.body.authGroup = req.params.group;
            }
            return next();
        } catch (error) {
            next(error);
        }
    },
    async setGroupActivationEvent (req, res, next) {
        try {
            if (!req.authGroup) throw Boom.preconditionRequired('authGroup is required');
            if (req.authGroup.active === false) {
                // verify that owner is an email
                const pattern = /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;
                const owner = req.authGroup.owner;
                if(pattern.test(owner)) {
                    // verify there are no other members
                    const members = await account.getAccounts(req.authGroup._id, { $top: 1 });
                    if (members.length === 0) {
                        // set flag
                        req.groupActivationEvent = true;
                        return next();
                    }
                }
            }
            return next ();
        } catch (error) {
            next(error);
        }
    },
    setNoCache(req, res, next) {
        res.set('Pragma', 'no-cache');
        res.set('Cache-Control', 'no-cache, no-store');
        next();
    },
    isIatGroupActivationAuthorized: authorizer.isIatAuthenticated,
    isAuthenticated: authorizer.isAuthenticated
};

export default mid;