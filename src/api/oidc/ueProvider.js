import {Provider} from 'oidc-provider';
const bodyParser = require('koa-bodyparser');
const cors = require('koa2-cors');
import events from '../../events/events';
import middle from '../../oidcMiddleware';
import {promisify} from 'util';
import helmet from 'helmet';
import crypto from 'crypto';

const config = require('../../config');
const TTL = 5*60*1000; // 5 minutes

const corsOptions = {
	origin: function(ctx) {
		//can get more restrictive later
		return '*';
	},
	allowMethods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
};

class UEProvider {
	constructor() {
		this.providerList = new Map();
	}
	element(provider) {
		return {
			ttl: new Date(Date.now() + TTL),
			provider
		};
	}
	get(agId) {
		return this.providerList.get(agId);
	}
	getAll() {
		return this.providerList;
	}
	define(group, issuer, options) {
		const agId = group.id || group._id;
		// Do not let this get bigger than 100 instances, you can always reinitialize
		if(this.providerList.size > 100) {
			const [f] = this.providerList.keys();
			this.providerList.delete(f);
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
		newProvider.use(middle.associatedClientProductCheck);
		newProvider.use(middle.noDeleteOnPrimaryClient);
		const security = {
			...helmet.contentSecurityPolicy.getDefaultDirectives(),
			...config.SECURITY_POLICY
		};
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
		this.providerList.set(agId, this.element(newProvider));
		events.providerEventEmitter(newProvider, group);
		return newProvider;
	}
	find(group, issuer, options) {
		const agId = group.id || group._id;
		const op = this.get(agId);
		if(!op?.provider || !op?.provider?.issuer) {
			return this.define(group, issuer, options);
		}
		if(new Date() > op?.ttl) {
			return this.define(group, issuer, options);
		}
		if(op?.provider?.issuer !== issuer) {
			return this.define(group, issuer, options);
		}
		return op.provider;
	}
	removeListeners(agId) {
		this.providerList.get(agId)?.provider?.removeAllListeners();
	}
	delete(agId) {
		this.removeListeners(agId);
		this.providerList.delete(agId);
	}
}

export default UEProvider;