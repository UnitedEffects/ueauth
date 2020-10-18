import Boom from '@hapi/boom';
import clients from "./api/oidc/client/clients";
import group from "./api/authGroup/group";
import IAT from "./api/oidc/initialAccess/iat";
import helper from "./helper";

const config = require('./config');

const mid = {
    async validateAuthGroup (ctx, next) {
        try {
            if(ctx.authGroup && ctx.authGroup.active === true) {
                ctx.req.params.group = ctx.authGroup.id;
                return next();
            }
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

            if (config.SINGLE_USE_IAT === true) {
                if (ctx.oidc.entities && ctx.oidc.entities.Client && ctx.oidc.entities.InitialAccessToken) {
                    if (ctx.response.status === 201) {
                        await IAT.deleteOne(ctx.oidc.entities.InitialAccessToken.jti, ctx.authGroup._id);
                    }
                }
            }
        }
    }
};

export default mid;