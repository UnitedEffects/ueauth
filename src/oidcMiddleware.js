import Boom from '@hapi/boom';
import clients from "./api/oidc/client/clients";
import group from "./api/authGroup/aGroup";

const mid = {
    async validateAuthGroup (ctx, next) {
        try {
            if (!ctx.req.params.group) throw Boom.preconditionRequired('authGroup is required');
            const result = await group.getOneByEither(ctx.req.params.group);
            if (!result) throw Boom.notFound('auth group not found');
            ctx.authGroup = result;
            ctx.req.params.group = result._id;
            return next();
        } catch (error) {
            return mid.koaErrorOut(ctx, error);
        }
    },
    async uniqueClientRegCheck(ctx, next) {
        try {
            if (ctx.request.body) ctx.request.body.auth_group = ctx.req.params.group;
            const checkMethods = ['PUT', 'POST', 'PATCH'];
            if (ctx.request.body && checkMethods.includes(ctx.method) && ctx.path.includes('/reg')) {
                const check = await clients.validateUniqueNameGroup(ctx.authGroup, ctx.request.body.client_name, ctx.request.body.client_id);
                if  (check===false) {
                    throw Boom.conflict('This client name already exists in your auth group');
                }
            }
            return next();
        } catch (error) {
            return mid.koaErrorOut(ctx, error);
        }

    },
    async clientCredentialApiAccessScope(ctx, next) {
        try {
            if (ctx.method.toLowerCase() === 'post' && ctx.path.toLowerCase() === '/token' && ctx.request.body && ctx.request.body.grant_type === 'client_credentials'); {
                const authGroup = ctx.authGroup;
                const scopes = ctx.request.body.scope;
                const splitScopes = scopes.split(' ');
                let access;
                let clientId;
                let cl;
                await Promise.all(splitScopes.map(async (scope) => {
                    if (scope.includes('api:access:')) {
                        access = scope.split(':');
                        if (access.length !== 3) throw Boom.badRequest('api:access scope request requires the clientId you are requesting access to');
                        clientId = access[2];
                        cl = await clients.getOne(authGroup, clientId);
                        if (!cl) throw Boom.badRequest(`client with ID ${clientId} not found in authGroup with ID ${authGroup._id} (a.k.a. ${authGroup.prettyName}). Can not grant token.`)
                    }
                }))
            }
            return next();
        } catch (error) {
            return mid.koaErrorOut(ctx, error);
        }
    },
    async koaErrorOut(ctx, error) {
        let tE = error;
        if (!Boom.isBoom(error)) tE = Boom.boomify(error);
        const output = tE.output.payload;
        delete output.statusCode;
        ctx.type = 'json';
        ctx.status = error.output.statusCode;
        ctx.body = output;
        ctx.app.emit('error', error, ctx);
    },
    async parseKoaOIDC(ctx, next) {
        await next();
        if (ctx.oidc){
            if(ctx.oidc.entities && ctx.oidc.entities.Client && ctx.oidc.entities.Client.auth_group !== ctx.req.params.group) {
                // returning a 404 rather than indicating that the auth group may exist but is not theirs
                return mid.koaErrorOut(ctx, Boom.notFound('auth group not found'));
            }
        }
    }
};

export default mid;