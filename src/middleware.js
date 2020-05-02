import { OpenApiValidator } from 'express-openapi-validate';
import Boom from '@hapi/boom';
import handleErrors from './customErrorHandler';
import { sayMiddleware } from './say';
import helper from './helper';
import group from './api/authGroup/aGroup';
import swag from './swagger';

const schema = new OpenApiValidator(swag);

const mid = {
    cores (req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, DELETE, PUT, PATCH, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, api_key, Authorization');
        next();
    },
    catch404 (req, res, next) {
        next(handleErrors.catch404());
    },
    async catchErrors (err, req, res, next) {
        const error = await handleErrors.parse(err);
        return res.respond(error);
    },
    responseIntercept: sayMiddleware.responseIntercept,
    async schemaCheck(req, res, next) {
        try {
            let path  = req.route.path;
            await Promise.all(Object.keys(req.params).map((p)=>{
                path = path.replace(`:${p}`, `{${p}}`);
            }));
            schema.validate(req.method.toString().toLowerCase(), path.toLowerCase())(req, res, next);
        } catch (error) {
            next(Boom.expectationFailed('OpenAPI Schema Validation'));
        }
    },
    async validateAuthGroup (req, res, next) {
        try {
            if (!req.params.authGroup) throw Boom.preconditionRequired('authGroup is required');
            if (helper.protectedNames(req.params.authGroup)) throw Boom.notFound('auth group not found');
            const result = await group.getOneByEither(req.params.authGroup);
            if (!result) throw Boom.notFound('auth group not found');
            req.authGroup = result;
            req.params.authGroup = result._id;
            return next();
        } catch (error) {
            next(error);
        }
    },
    async captureAuthGroupInBody (req, res, next) {
        try {
            // assumes you've done the validation
            if (!req.params.authGroup) throw Boom.preconditionRequired('authGroup is required');
            if (req.body) {
                req.body.authGroup = req.params.authGroup;
            }
            return next();
        } catch (error) {
            next(error);
        }
    }
};

export default mid;