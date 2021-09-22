import Boom from '@hapi/boom';
import clients from './api/oidc/client/clients';
import group from './api/authGroup/group';
import IAT from './api/oidc/initialAccess/iat';
import errHandler from './customErrorHandler';
import NodeCache from 'node-cache';

const myCache = new NodeCache();
const config = require('./config');

const mid = {
	async validateAuthGroup (ctx, next) {
		try {
			if(ctx.authGroup && ctx.authGroup.active === true) {
				ctx.req.params.group = ctx.authGroup.id || ctx.authGroup._id;
				return next();
			}
			if (!ctx.req.params.group) throw Boom.preconditionRequired('authGroup is required');
			let result;
			console.info(ctx.req);
			const cache = (ctx.req.query.resetCache) ? undefined : await myCache.get(`AG:${ctx.req.params.group}`);
			if(!cache) {
				result = await group.getOneByEither(ctx.req.params.group);
			} else {
				console.info('using cached group');
				//console.info(cache);
				result = JSON.parse(cache);
			}
			if (!result) throw Boom.notFound('auth group not found');
			if (!cache) {
				const holdThis = JSON.parse(JSON.stringify(result));
				holdThis._id = result._id || result.id;
				holdThis.owner = result.owner;
				holdThis.active = result.active;
				await myCache.set(`AG:${ctx.req.params.group}`, JSON.stringify(holdThis), 3600);
			}
			ctx.authGroup = result;
			ctx.req.params.group = result._id;
			return next();
		} catch (error) {
			return mid.koaErrorOut(ctx, error);
		}
	},
	async noDeleteOnPrimaryClient(ctx, next) {
		try {
			if (ctx.method !== 'DELETE') return next();
			if (!ctx.path.includes('/reg')) return next();
			if (ctx.path.includes(ctx.authGroup.associatedClient)) {
				throw Boom.badRequest('You can not delete the primary client of your auth group');
			}
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
				if(ctx.method === 'PUT' || ctx.method === 'PATCH') {
					if(!ctx.request.body.client_id) {
						throw Boom.badRequest('client_id should be included in the request body');
					}
				}
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
		if(error.data) {
			output.details = error.data;
		}
		delete output.statusCode;
		ctx.type = 'json';
		ctx.status = error.output.statusCode;
		ctx.body = output;
		ctx.app.emit('error', error, ctx);
	},

	async parseKoaOIDC(ctx, next) {
		await next();
		if(ctx.response && ctx.response.body && ctx.response.body.error) {
			const error = {
				error: ctx.response.body.error,
				message: `OIDC - ${(ctx.response.message) ?
					`${ctx.response.message} - ${ctx.response.body.error_description}` : ctx.response.body.error_description}`
			};
			if (error.error === 'server_error') {
				error.message = `Unexpected OIDC error. ${ctx.response.body.error_description}. Work with admin to review Logs`;
			}
			ctx.response.body = await errHandler.oidcLogger(error);
		}

		if (ctx.oidc){
			if(ctx.oidc.entities && ctx.oidc.entities.Client && ctx.oidc.entities.Client.auth_group !== ctx.req.params.group) {
				// returning a 404 rather than indicating that the auth group may exist but is not theirs
				if(ctx.oidc.entities.Interaction && ctx.oidc.entities.Interaction.kind === 'Interaction') {
					// letting the login interaction controller handle this for us
					return;
				}
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