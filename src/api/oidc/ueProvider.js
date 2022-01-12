import {Provider} from 'oidc-provider';
const bodyParser = require('koa-bodyparser');
const cors = require('koa2-cors');
import events from '../../events/events';
import middle from '../../oidcMiddleware';
import {promisify} from 'util';
import helmet from 'helmet';
import crypto from 'crypto';

const config = require('../../config');

const corsOptions = {
	origin: function(ctx) {
		//can get more restrictive later
		return '*';
	},
	allowMethods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
};

class UEProvider {
	constructor() {
		this.providerList = {};
	}
	get(agId) {
		return this.providerList[agId];
	}
	getAll() {
		return this.providerList;
	}
	define(group, issuer, options) {
		const agId = group.id || group._id;
		// Do not let this get bigger than 100 instances, you can always reinitialize
		if(Object.keys(this.providerList).length > 100) {
			const oldStream = Object.keys(this.providerList)[0];
			this.delete(oldStream);
		}
		const newProvider = new Provider(issuer, options);
		newProvider.proxy = true;
		newProvider.use(bodyParser());
		newProvider.use(cors(corsOptions));
		newProvider.use(async (ctx, next) => {
			ctx.authGroup = group;
			return next();
		});
		newProvider.use(middle.validateAuthGroup);
		newProvider.use(middle.uniqueClientRegCheck);
		newProvider.use(middle.noDeleteOnPrimaryClient);
		const security = {
			...helmet.contentSecurityPolicy.getDefaultDirectives(),
			'script-src': [`'self'`, (req, res) => `'nonce-${res.locals.cspNonce}'`],
			'img-src': ['*'],
			'frame-ancestors': ['*.unitedeffects.com']
		};
		if(config.ENV !== 'production') {
			security['frame-ancestors'].push('localhost');
		}
		const pHelmet = promisify(helmet({
			contentSecurityPolicy: {
				directives: security
			},
		}));
		newProvider.use(async (ctx, next) => {
			ctx.res.locals || (ctx.res.locals = {});
			ctx.res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
			await pHelmet(ctx.req, ctx.res);
			return next();
		});
		newProvider.use(middle.parseKoaOIDC);
		this.providerList[agId] = newProvider;
		//async event emitter
		events.providerEventEmitter(this.providerList[agId], group);
		return this.providerList[agId];
	}
	find(group, issuer, options) {
		const agId = group.id || group._id;
		const op = this.get(agId);
		if(!op || !op.issuer) {
			return this.define(group, issuer, options);
		}
		if(op.issuer !== issuer) {
			return this.define(group, issuer, options);
		}
		return op;
	}
	removeListeners(agId) {
		this.providerList[agId].removeAllListeners();
	}
	delete(agId) {
		this.removeListeners(agId);
		delete this.providerList[agId];
	}
}

export default UEProvider;