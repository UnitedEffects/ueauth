import Boom from '@hapi/boom';
import clients from './api/oidc/client/clients';
import product from './api/products/product';
import IAT from './api/oidc/initialAccess/iat';
import errHandler from './customErrorHandler';
import helper from './helper';
const config = require('./config');

const mid = {
	async validateAuthGroup (ctx, next) {
		try {
			if(ctx.authGroup && ctx.authGroup.active === true) {
				if(ctx.req.params.group !== (ctx.authGroup.id || ctx.authGroup._id)) {
					ctx.req.params.group = ctx.authGroup.id || ctx.authGroup._id;
				}
				return next();
			}
			if (!ctx.req.params.group) throw Boom.preconditionRequired('authGroup is required');
			const result = await helper.cacheAG(ctx.req.query.resetCache, 'AG', ctx.req.params.group);
			ctx.authGroup = result;
			ctx.req.params.group = result._id || result.id;
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

	async associatedClientProductCheck(ctx, next) {
		try {
			const checkMethods = ['PUT', 'POST', 'PATCH'];
			if (ctx.request?.body && checkMethods.includes(ctx.method) && ctx.path.includes('/reg')) {
				if(ctx.request?.body?.associated_product) {
					if(typeof ctx.request?.body?.associated_product !== 'string') {
						throw Boom.badRequest('Associated Product should be a string uuid');
					}
					const prod = await product.getProduct(ctx.authGroup.id, ctx.request.body.associated_product);
					if(!prod) throw Boom.badRequest('Associated Product does not exist');
					ctx.associatedProductAdded = ctx.request.body.associated_product;
				}
			}
			return next();
		} catch (error) {
			return mid.koaErrorOut(ctx, error);
		}
	},

	async postMiddleAssociatedProductAdd(ctx) {
		const checkMethods = ['PUT', 'POST', 'PATCH'];
		if (ctx.request?.body && checkMethods.includes(ctx.method) && ctx.path.includes('/reg')) {
			if(ctx.associatedProductAdded) {
				if(ctx.oidc?.entities?.Client?.clientId){
					try {
						await product.addAssociatedClient(ctx.authGroup.id, ctx.associatedProductAdded, ctx.oidc.entities.Client.clientId);
					} catch (error) {
						console.error('Could not associate client to product array');
						console.error(error);
					}
				}
			}
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
				message: 'OIDC'
			};
			if (ctx.response.body.message) {
				error.message = ctx.response.body.message;
			} else {
				if (ctx.response.message) error.message = `${error.message} - ${ctx.response.message}`;
				if (ctx.response.body.error_description) error.message = `${error.message} - ${ctx.response.body.error_description}`;
			}
			if (error.error === 'server_error') {
				error.message = `Unexpected OIDC error. ${ctx.response.body.error_description}. Work with admin to review Logs`;
			}
			if(ctx.req.requestId) error['_id'] = ctx.req.requestId;
			ctx.response.body = await errHandler.oidcLogger(error);
		}
		if (ctx.oidc){
			if(ctx.oidc.entities && ctx.oidc.entities.Client && ctx.oidc.entities.Client.auth_group !== ctx.req.params.group) {
				// returning a 404 rather than indicating that the auth group may exist but is not theirs
				if(ctx.oidc.entities.Interaction && ctx.oidc.entities.Interaction.kind === 'Interaction') {
					// letting the login interaction controller handle this for us
					return;
				}
				return mid.koaErrorOut(ctx, Boom.notFound('auth group not found. try explicitly adding auth_group to the client reg request.'));
			}

			await mid.postMiddleAssociatedProductAdd(ctx);
			if (config.SINGLE_USE_IAT === true) {
				if (ctx.oidc?.entities?.Client && ctx.oidc?.entities?.InitialAccessToken) {
					if (ctx.response.status === 201) {
						await IAT.deleteOne(ctx.oidc.entities.InitialAccessToken.jti, ctx.authGroup._id);
					}
				}
			}
		}
	}
};

export default mid;