import { OpenApiValidator } from 'express-openapi-validate';
import Boom from '@hapi/boom';
import handleErrors from './customErrorHandler';
import { sayMiddleware } from './say';
import authorizer from './auth/auth';
import helper from './helper';
import group from './api/authGroup/group';
import account from './api/accounts/account';
import enforce from './permissions';
import mongoose from 'mongoose';
import swag from './swagger';

const config = require('./config');
const p = require('../package.json');
const date = new Date();
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
    async health (req, res) {
        return res.json(
            {
                server: 'running',
                db: mongoose.STATES[mongoose.connection.readyState]
            }
        );
    },
    async version (req, res) {
        return res.json( {
            data: {
                api: p.name,
                version: p.version,
                copyright: `Copyright (c) ${date.getFullYear()} United Effects LLC`
            }
        });
    },
    async schemaCheck(req, res, next) {
        try {
            let path  = `/api${req.route.path}`;
            await Promise.all(Object.keys(req.params).map((p)=>{
                path = path.replace(`:${p}`, `{${p}}`);
            }));
            return schema.validate(req.method.toString().toLowerCase(), path.toLowerCase())(req, res, next);
        } catch (error) {
            next(Boom.expectationFailed(error.message || 'Something unexpected went wrong validating OpenAPI Schema'));
        }
    },
    async validateAuthGroup (req, res, next) {
        try {
            // special case for /group paths
            if (req.path.includes('/group/')){
                if (req.params.id) {
                    req.params.group = req.params.id;
                }
            }
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
            if(!req.user) return next();
            if(!req.authGroup) return next();
            req.permissions = {
                agent: req.user,
                sub_group: req.user.subject_group.id,
                req_group: req.authGroup.id,
                enforceOwn: false,
                roles: []
            };
            if (req.user.group === req.authGroup.id) {
                req.permissions.roles.push('member');
            }
            if(req.user.subject_group.prettyName === 'root') {
                if(req.user.group === req.permissions.sub_group){
                    //req.permissions.roles.super = true;
                    req.permissions.roles.push('super');
                }
            }
            if(req.user.sub && req.authGroup.owner === req.user.sub) {
                //req.permissions.roles.owner = true;
                req.permissions.roles.push('owner');
            }
            // todo - plugin to capture permission claim or query external service
            return next();
        } catch (error) {
            next(error);
        }
    },
    access: enforce.permissionEnforce,
    async openGroupRegAuth(req, res, next) {
        try {
            if (config.OPEN_GROUP_REG === true) return next();
            return this.isAuthenticated(req, res, next);
        } catch (error) {
            next(error);
        }
    },
    async openGroupRegPermissions(req, res, next) {
        try {
            if (config.OPEN_GROUP_REG === true) return next();
            return this.permissions(req, res, next);
        } catch (error) {
            next(error);
        }
    },
    async openGroupRegAccess(req, res, next) {
        try {
            if (config.OPEN_GROUP_REG === true) return next();
            if(req.permissions && req.permissions.roles && req.permissions.roles.length !== 0 && req.permissions.roles.includes('super')) {
                return next();
            }
            throw Boom.badRequest('Public Group Registration is Disabled - Contact Admin to be Added');
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
    isIatGroupActivationAuthorized(req, res, next) {
        if(req.groupActivationEvent === true) return authorizer.isIatAuthenticated(req, res, next);
        if(req.authGroup.locked === true) return authorizer.isLockedGroupIatAuth(req, res, next);
        return next();
    },
    isAuthenticated: authorizer.isAuthenticated
};

export default mid;