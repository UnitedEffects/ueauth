import { OpenApiValidator } from 'express-openapi-validate';
import Boom from '@hapi/boom';
import handleErrors from './customErrorHandler';
import { sayMiddleware } from './say';
import swag from './swagger';
import clients from "./api/oidc/client/clients";

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
    async validateAuthGroup (ctx, next) {
        try {
            //todo you need a service for this and then query it, replace the below once you ahve it
            if (ctx.req.params.authGroup !== 'unitedeffects' && ctx.req.params.authGroup !== 'test') throw Boom.notFound('auth group not found');
            if (ctx.request.body && ctx.path === '/reg') {
                const check = await clients.validateUniqueNameGroup(ctx.request.body.auth_group, ctx.request.body.client_name);
                if  (check===false) {
                    throw Boom.conflict('This client name already exists in your auth group');
                }
            }
            return next();
        } catch (error) {
            return mid.koaErrorOut(ctx, error);
        }
    },
    async koaErrorOut(ctx, error) {
        if (!Boom.isBoom(error)) tE = Boom.boomify(error);
        const output = error.output.payload;
        delete output.statusCode;
        ctx.type = 'json';
        ctx.status = error.output.statusCode;
        ctx.body = output;
        ctx.app.emit('error', error, ctx);
    },
    async parseKoaOIDC(ctx, next) {
        if (ctx.request.body) ctx.request.body.auth_group = ctx.req.params.authGroup;
        await next();
        if (ctx.path === '/token') {
            if(ctx.oidc.entities.Client.auth_group !== ctx.req.params.authGroup) {
                // returning a 404 rather than indicating that the auth group may exist but is not theirs
                return mid.koaErrorOut(ctx, Boom.notFound('auth group not found'));
            }
        }
    }
};

export default mid;