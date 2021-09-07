import { Provider } from 'oidc-provider';
import { v4 as uuid } from 'uuid';
import Pug from 'koa-pug';
import path from 'path';
import Account from '../accounts/accountOidcInterface';
import middle from '../../oidcMiddleware';
import interactions from './interactions/interactions';
import IAT from './models/initialAccessToken';

const bodyParser = require('koa-bodyparser');
const config = require('../../config');
const MongoAdapter = require('./dal');

const coreScopes = config.CORE_SCOPES();

const {
	errors: { InvalidClientMetadata, AccessDenied, OIDCProviderError, InvalidRequest },
} = require('oidc-provider');

function oidcConfig(g) {
	const jwks = JSON.parse(JSON.stringify({
		keys: g.config.keys
	}));
	const oidcOptions = {
		adapter: MongoAdapter,
		clients: [],
		jwks,
		findAccount: Account.findAccount,
		async findById(ctx, sub, token) {
			// @param ctx - koa request context
			// @param sub {string} - account identifier (subject)
			// @param token - is a reference to the token used for which a given account is being loaded,
			//   is undefined in scenarios where claims are returned from authorization endpoint
			return {
				accountId: sub,
				// @param use {string} - can either be "id_token" or "userinfo", depending on
				//   where the specific claims are intended to be put in
				// @param scope {string} - the intended scope, while oidc-provider will mask
				//   claims depending on the scope automatically you might want to skip
				//   loading some claims from external resources or through db projection etc. based on this
				//   detail or not return them in ID Tokens but only UserInfo and so on
				// @param claims {object} - the part of the claims authorization parameter for either
				//   "id_token" or "userinfo" (depends on the "use" param)
				// @param rejected {Array[String]} - claim names that were rejected by the end-user, you might
				//   want to skip loading some claims from external resources or through db projection
				async claims(use, scope) {
					return {sub};
				},
			};
		},
		claims: {
			openid: ['sub', 'group'],
			email: ['email', 'verified'],
			username: ['username'],
		},
		scopes: [
			'openid',
			'offline_access'].concat(coreScopes).concat(g.config.scopes),
		interactions: {
			url(ctx, interaction) {
				return `/${ctx.authGroup._id}/interaction/${interaction.uid}`;
			},
		},
		features: {
			devInteractions: {enabled: false}, //THIS SHOULD NEVER BE TRUE
			introspection: {enabled: true},
			revocation: {enabled: true},
			clientCredentials: {enabled: true},
			userinfo: {enabled: true},
			backchannelLogout: {
				enabled: true,
				ack: 'draft-06'
			},
			rpInitiatedLogout: {
				enabled: true,
				logoutSource,
				postLogoutSuccessSource
			},
			encryption: { enabled: true },
			registration: {
				enabled: true,
				idFactory: uuid,
				initialAccessToken: true,
				policies: {
					'auth_group': async function (ctx, properties) {
						try {
							if (ctx.method === 'POST') {
								if (!ctx.oidc.entities.InitialAccessToken.jti) {
									throw new AccessDenied();
								}
								const iatAg = await IAT.findOne({_id: ctx.oidc.entities.InitialAccessToken.jti}).select({'payload.auth_group': 1});
								if (!iatAg) {
									throw new AccessDenied();
								}
								if (!iatAg.payload) {
									throw new AccessDenied();
								}
								if (iatAg.payload.auth_group !== properties.auth_group) {
									throw new AccessDenied();
								}
							} else {
								const id = ctx.authGroup._id || ctx.authGroup.id;
								if(ctx.authGroup.associatedClient === ctx.oidc.entities.Client.clientId){
									console.error('attempted to update client associated to auth-group');
									throw new AccessDenied();
								}
								if (id !== ctx.oidc.entities.Client.auth_group) {
									console.error('mismatch of request authGroup and client authGroup');
									throw new AccessDenied();
								}
								if (id !== ctx.request.body.auth_group) {
									console.error('mismatch of request authGroup and request-body authGroup');
									throw new AccessDenied();
								}
								if (ctx.oidc.entities.Client.auth_group !== ctx.request.body.auth_group) {
									console.error('mismatch of client authGroup and request-body authGroup');
									throw new AccessDenied();
								}
							}
						} catch (error) {
							console.error(error);
							if (error.name === 'AccessDenied') throw error;
							throw new OIDCProviderError(error.message);
						}

					}
				}
			},
			registrationManagement: {
				enabled: true,
				rotateRegistrationAccessToken: true
			},
			resourceIndicators: {
				defaultResource: (ctx, client, oneOf) => {
					if(oneOf) {
						return oneOf;
					}
					return undefined;
				},
				enabled: true,
				getResourceServerInfo: (ctx, resourceIndicator, client) => {
					const resource = {
						audience: resourceIndicator,
						accessTokenFormat: 'jwt',
						scope: coreScopes.concat(g.config.scopes).join(' ')
					}
					if(client.scope) {
						resource.scope = client.scope.replace('openid', '').trim();
					}
					return (resource);
				},
				useGrantedResource: (ctx, model) => {
					return true;
				}
			}
		},
		extraClientMetadata: {
			properties: ['auth_group', 'client_name', 'client_skip_consent', 'register_url', 'client_optional_skip_logout_prompt'],
			validator(key, value, metadata) {
				if (key === 'auth_group') {
					try {
						if (value === undefined || value === null) {
							throw new InvalidClientMetadata(`${key} is required`);
						}
						if (value !== metadata.auth_group) {
							throw new InvalidClientMetadata('You can not move a client from one auth group to another');
						}
					} catch (error) {
						if (error.name === 'InvalidClientMetadata') throw error;
						throw new InvalidClientMetadata(error.message);
					}
				}
				if (key === 'client_name') {
					try {
						if (value === undefined || value === null) throw new InvalidClientMetadata(`${key} is required`);
					} catch (error) {
						if (error.name === 'InvalidClientMetadata') throw error;
						throw new InvalidClientMetadata(error.message);
					}
				}
				if (key === 'client_skip_consent') {
					try {
						if (value === undefined || value === null) value = false;
						if (typeof value !== 'boolean') throw new InvalidClientMetadata(`${key} must be a boolean value`);
					} catch (error) {
						if (error.name === 'InvalidClientMetadata') throw error;
						throw new InvalidClientMetadata(error.message);
					}
				}
				if (key === 'client_optional_skip_logout_prompt') {
					try {
						if (value === undefined || value === null) value = false;
						if (typeof value !== 'boolean') throw new InvalidClientMetadata(`${key} must be a boolean value`);
					} catch (error) {
						if (error.name === 'InvalidClientMetadata') throw error;
						throw new InvalidClientMetadata(error.message);
					}
				}
			}
		},
		formats: {
			customizers: {
				async jwt(ctx, token, jwt) {
					const audience = jwt.payload.aud.split(' ');
					if(audience.length > 1) jwt.payload.aud = audience;
					if(ctx && ctx.oidc && ctx.oidc.body && ctx.oidc.body.custom) jwt.payload.custom = ctx.oidc.body.custom;
				}
			},
			ClientCredentials(ctx, token) {
				return token.aud ? 'jwt' : 'opaque';
			},
			AccessToken(ctx, token) {
				return token.aud ? 'jwt' : 'opaque';
			}
		},
		cookies: {
			keys: config.COOKIE_KEYS(),
			long: {
				httpOnly: true,
				overwrite: true,
				sameSite: 'none',
				signed: true
			},
			short: {
				httpOnly: true,
				overwrite: true,
				sameSite: 'lax',
				signed: true
			},
			names: {
				interaction: `${g.prettyName}_interaction`,
				resume: `${g.prettyName}_interaction_resume`,
				session: `${g.prettyName}_session`
			}
		},
		async extraTokenClaims(ctx, token) {
			let claims = {};
			if (ctx) {
				claims = {
					group: ctx.authGroup._id
				};
			} else {
				let scope;
				let group;
				if (typeof token.scope !== 'object') {
					try {
						scope = token.scope.split(' ');
					} catch (e) {
						console.error(e);
						scope = [];
					}
				} else scope = token.scope;

				for(let i=0; i<scope.length; i++) {
					if(scope[i].includes('group')){
						group = scope[i].split(':');
						claims = {
							group: group[group.length-1]
						};
					}
				}
			}
			//todo permissions reference (or object) likely added here...
			return claims;
		},
		responseTypes: [
			'code id_token token',
			'code id_token',
			'code token',
			'code',
			'id_token token',
			'id_token',
			'none',
		],
		async renderError(ctx, out, error) {
			const pug = new Pug({
				viewPath: path.resolve(__dirname, '../../../views'),
				basedir: 'path/for/pug/extends',
			});
			ctx.type = 'html';
			const options = await interactions.oidcRenderErrorOptions(ctx.authGroup, out);
			ctx.body = await pug.render('error', options);
		},
		ttl: {
			AccessToken: g.config.ttl.accessToken, //ms('1h') / 1000,
			AuthorizationCode: g.config.ttl.authorizationCode,//ms('10m') / 1000,
			ClientCredentials: g.config.ttl.clientCredentials,//ms('1h') / 1000,
			DeviceCode: g.config.ttl.deviceCode,//ms('1h') / 1000,
			IdToken: g.config.ttl.idToken,//ms('1h') / 1000,
			RefreshToken: g.config.ttl.refreshToken,//ms('1d') / 1000,
			Interaction: g.config.ttl.interaction,//ms('1h') / 1000,
			Session: g.config.ttl.session,//ms('10d') / 1000,
			Grant: g.config.ttl.grant,//ms('10d') / 1000
		},
		allowOmittingSingleRegisteredRedirectUri: true,
		pkce: {
			required: () => false,
		},
	};

	// make sure we've activated initial access token correctly
	if(oidcOptions.features &&
		oidcOptions.features.registration &&
		oidcOptions.features.registration.initialAccessToken === false) {
		delete oidcOptions.features.registration.policies;
	}
	return oidcOptions;
}

function oidcWrapper(tenant) {
	const options = oidcConfig(tenant);
	const issuer = `${config.PROTOCOL}://${config.SWAGGER}/${tenant._id}`;
	const oidc = new Provider(issuer, options);
	oidc.proxy = true;
	oidc.use(bodyParser());
	oidc.use(middle.parseKoaOIDC);
	oidc.use(async (ctx, next) => {
		ctx.authGroup = tenant;
		return next();
	});
	oidc.use(middle.validateAuthGroup);
	oidc.use(middle.uniqueClientRegCheck);
	oidc.use(middle.noDeleteOnPrimaryClient);
	return oidc;
}

async function logoutSource(ctx, form) {
	try {
		const action = ctx.oidc.urlFor('end_session_confirm');
		const name = (ctx.oidc && ctx.oidc.client && ctx.oidc.client.clientName) ? ctx.oidc.client.clientName : ctx.authGroup.name;
		const pug = new Pug({
			viewPath: path.resolve(__dirname, '../../../views'),
			basedir: 'path/for/pug/extends',
		});
		const options = await interactions.oidcLogoutSourceOptions(ctx.authGroup, name, action, ctx.oidc.session.state.secret);
		// todo if we see skip-prompt=true
		// if clientSkipLogoutOption=true
		// return the post confirm

		if (ctx.req.query && ctx.req.query.json && ctx.req.query.json === 'true') {
			// enable REST response
			ctx.type='json';
			ctx.body = {
				action: options.title,
				confirmUri: `${options.actionUrl}`,
				xsrf: options.secret
			};
		} else {
			// otherwise show the prompt
			ctx.type = 'html';
			ctx.body = await pug.render('logout', options);
		}
	} catch (error) {
		throw new OIDCProviderError(error.message);
	}
}

async function postLogoutSuccessSource(ctx) {
	const {
		clientName, clientUri, initiateLoginUri, logoUri, policyUri, tosUri,
	} = ctx.oidc.client || {}; // client is defined if the user chose to stay logged in with the OP
	const name = (clientName) ? clientName : ctx.authGroup.name;
	const pug = new Pug({
		viewPath: path.resolve(__dirname, '../../../views'),
		basedir: 'path/for/pug/extends',
	});
	const message = (!ctx.oidc.client) ? `Logout action ${name ? `with ${name}`: ''} was successful` : 'You are still logged in';
	const options = await interactions.oidcPostLogoutSourceOptions(ctx.authGroup, message, clientUri, initiateLoginUri, logoUri, policyUri, tosUri, clientName);
	ctx.type = 'html';
	ctx.set('json-data', JSON.stringify({
		title: options.title,
		message: options.message,
		authGroup: options.authGroup
	}));
	ctx.body = await pug.render('logoutSuccess', options);
}

export default oidcWrapper;