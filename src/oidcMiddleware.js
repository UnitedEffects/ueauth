import Boom from '@hapi/boom';
import clients from "./api/oidc/client/clients";
import group from "./api/authGroup/aGroup";

const mid = {
    async validateAuthGroup (ctx, next) {
        try {
            if (!ctx.req.params.authGroup) throw Boom.preconditionRequired('authGroup is required');
            const result = await group.getOneByEither(ctx.req.params.authGroup);
            if (!result) throw Boom.notFound('auth group not found');
            const checkMethods = ['PUT', 'POST', 'PATCH'];
            if (ctx.request.body && checkMethods.includes(ctx.method) && ctx.path.includes('/reg')) {
                const check = await clients.validateUniqueNameGroup(ctx.request.body.auth_group, ctx.request.body.client_name, ctx.request.body.client_id);
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
        if (ctx.request.body) ctx.request.body.auth_group = ctx.req.params.authGroup;
        await next();
        //if (ctx.path === '/token') {
            if (ctx.oidc){
                if(ctx.oidc.entities && ctx.oidc.entities.Client && ctx.oidc.entities.Client.auth_group !== ctx.req.params.authGroup) {
                    // returning a 404 rather than indicating that the auth group may exist but is not theirs
                    console.info(ctx.oidc.entities.Client.auth_group);
                    console.info(ctx.req.params.authGroup)
                    return mid.koaErrorOut(ctx, Boom.notFound('auth group not found'));
                }
            }
        //}
    }
};

export default mid;