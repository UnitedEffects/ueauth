import { Provider } from 'oidc-provider';
import { v4 as uuid } from 'uuid';
import ms from 'ms';
import Pug from 'koa-pug';
import path from 'path';
import Account from '../accounts/accountOidcInterface';
import Client from './client/clients';
import middle from '../../oidcMiddleware';

import IAT from './models/initialAccessToken';

const bodyParser = require('koa-bodyparser');
const config = require('../../config');
const MongoAdapter = require('./dal');

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
			'offline_access'
		],
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
			backchannelLogout: { enabled: false },
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
					if(oneOf) return oneOf;
					// client resource url?
					return undefined;
				},
				enabled: true,
				getResourceServerInfo: (ctx, resourceIndicator, client) => {
					return ({
						audience: resourceIndicator,
						accessTokenFormat: 'jwt',
					});
				},
				useGrantedResource: (ctx, model) => {
					return true;
				}
			}
		},
		extraClientMetadata: {
			properties: ['auth_group', 'client_name', 'tosUri', 'policyUri'],
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
			}
		},
		formats: {
			customizers: {
				async jwt(ctx, token, jwt) {
					if(ctx && ctx.oidc && ctx.oidc.body && ctx.oidc.body.custom) jwt.payload.custom = ctx.oidc.body.custom;
					//todo this (all below) is probably not needed
					/*
					console.info('customizer');
					console.info(token);
					console.info(ctx.oidc.body);
					if(token.kind === 'AccessToken') {
						if(ctx && ctx.oidc && ctx.oidc.body) {
							if (ctx.oidc.body.format === 'jwt' && (jwt.payload && !jwt.payload.aud)) {
								//jwt.payload.aud = token.clientId;
							}
						}
						if (jwt.payload && !jwt.payload.aud) {
							//throw new InvalidRequest('Audience is required for jwt access tokens');
						}
					}

					// todo - this is probably wrong...
					if(token.kind === 'ClientCredential') {
						if (ctx && ctx.oidc && ctx.oidc.body) {
							if (ctx.oidc.body.audience) {
								const reqAud = ctx.oidc.body.audience.split(',');
								const aud = [];
								let check;
								aud.push(token.clientId);
								await Promise.all(reqAud.map(async (id) => {
									if (!aud.includes(id)) {
										check = await Client.getOne(ctx.authGroup, id);
										if (check) aud.push(id);
										else throw new InvalidRequest(`audience not registered: ${ctx.oidc.body.audience}`);
									}
								}));
								jwt.payload.aud = aud;
							}
						}
					}*/
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
			//todo permissions here?
			return claims;
		},
		//todo figure out if we care token standalone was removed
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
			console.error(error);
			const pug = new Pug({
				viewPath: path.resolve(__dirname, '../../../views'),
				basedir: 'path/for/pug/extends',
			});
			ctx.type = 'html';
			ctx.body = await pug.render('error', {title: 'oops! something went wrong', message: 'You may have navigated here by mistake', details: Object.entries(out).map(([key, value]) => `<p><strong>${key}</strong>: ${value}</p>`).join('')});
		},
		ttl: {
			AccessToken: ms('1h') / 1000,
			AuthorizationCode: ms('10m') / 1000,
			ClientCredentials: ms('100y') / 1000,
			DeviceCode: ms('1h') / 1000,
			IdToken: ms('1h') / 1000,
			RefreshToken: ms('1d') / 1000,
			Interaction: ms('1h') / 1000,
			Session: ms('10d') / 1000,
			Grant: ms('10d') / 1000
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

		const options = {title: 'Log Out', message: `Are you sure you want to sign-out from ${name}?`, formId: 'op.logoutForm', actionUrl: action, secret: ctx.oidc.session.state.secret, inName:'xsrf' };
		ctx.type = 'html';
		ctx.body = await pug.render('logout', options);
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
	const loginUrl = `${ctx.oidc.urlFor('authorization')}?client_id=${ctx.authGroup.associatedClient}&response_type=code id_token&scope=openid%20email&nonce=${uuid()}&state=${uuid()}`;
	const message = `Logout action ${name ? `with ${name}`: ''} was successful`;
	const options = {title: 'Success', message, clientUri, initiateLoginUri, logoUri, policyUri, tosUri, loginUrl, authGroup: {
		name: ctx.authGroup.name,
		primaryPrivacyPolicy: ctx.authGroup.primaryPrivacyPolicy,
		primaryTOS: ctx.authGroup.primaryTOS,
		primaryDomain: ctx.authGroup.primaryDomain }};
	ctx.type = 'html';
	ctx.body = await pug.render('logoutSuccess', options);
}

export default oidcWrapper;