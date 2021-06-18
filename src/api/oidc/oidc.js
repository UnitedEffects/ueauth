import { Provider } from 'oidc-provider';
import { v4 as uuid } from 'uuid';
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

async function logoutSource(ctx, form) {
	// @param ctx - koa request context
	// @param form - form source (id="op.logoutForm") to be embedded in the page and submitted by
	//   the End-User
	console.info(form);
	console.info(ctx.oidc.client);
	ctx.body = `<!DOCTYPE html>
    <head>
      <title>Logout Request</title>
      <style>/* css and html classes omitted for brevity, see lib/helpers/defaults.js */</style>
    </head>
    <body>
      <div>
        <h1>Do you want to sign-out from ${ctx.host}?</h1>
        ${form}
        <button autofocus type="submit" form="op.logoutForm" value="yes" name="logout">Yes, sign me out</button>
        <button type="submit" form="op.logoutForm">No, stay signed in</button>
      </div>
    </body>
    </html>`;
}

async function postLogoutSuccessSource(ctx) {
	// @param ctx - koa request context
	const {
		clientId, clientName, clientUri, initiateLoginUri, logoUri, policyUri, tosUri,
	} = ctx.oidc.client || {}; // client is defined if the user chose to stay logged in with the OP
	const display = clientName || clientId;

	console.info(display);
	console.info(ctx.oidc.client);

	ctx.body = `<!DOCTYPE html>
    <head>
      <title>Sign-out Success</title>
      <style>/* css and html classes omitted for brevity, see lib/helpers/defaults.js */</style>
    </head>
    <body>
      <div>
        <h1>Sign-out Success</h1>
        <p>Your sign-out ${display ? `with ${display}` : ''} was successful.</p>
      </div>
    </body>
    </html>`;
}

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
				async claims(use, scope, claims, rejected) {
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
			'openid'
		],
		dynamicScopes: [
			///api:[a-zA-Z0-9_-]*$/
		],
		interactions: {
			url(ctx) {
				return `/${ctx.authGroup._id}/interaction/${ctx.oidc.uid}`;
			},
		},
		features: {
			devInteractions: {enabled: false}, //THIS SHOULD NEVER BE TRUE
			introspection: {enabled: true},
			revocation: {enabled: true},
			clientCredentials: {enabled: true},
			userinfo: {enabled: true},
			rpInitiatedLogout: {
				enabled: true,
				logoutSource,
				postLogoutSuccessSource
			},
			//jwtResponseModes: { enabled: true },
			//sessionManagement: { enabled: true},
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
			ClientCredentials(ctx, token) {
				const types = ['jwt', 'legacy', 'opaque', 'paseto'];
				if (ctx && ctx.oidc && ctx.oidc.body) {
					if (types.includes(ctx.oidc.body.format))
						return ctx.oidc.body.format;

				}
				return token.aud ? 'jwt' : 'opaque';
			},
			AccessToken(ctx, token) {
				const types = ['jwt', 'legacy', 'opaque', 'paseto'];
				if (ctx && ctx.oidc && ctx.oidc.body) {
					if (types.includes(ctx.oidc.body.format))
						return ctx.oidc.body.format;

				}
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
		async extraAccessTokenClaims(ctx, token) {
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
		async audiences(ctx, sub, token, use) {
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
					return aud;
				}
			}
			return undefined;
		},
		responseTypes: [
			'code id_token',
			'code',
			'token',
			'id_token',
			'none'
		],
		async renderError(ctx, out, error) {
			console.error(error);
			const pug = new Pug({
				viewPath: path.resolve(__dirname, '../../../views'),
				basedir: 'path/for/pug/extends',
			});
			ctx.type = 'html';
			ctx.body = await pug.render('error', {title: 'oops! something went wrong', message: 'You may have navigated here by mistake', details: Object.entries(out).map(([key, value]) => `<p><strong>${key}</strong>: ${value}</p>`).join('')});
		}
	};

	// make sure we've activated initial access token correctly
	if(oidcOptions.features.registration.initialAccessToken === false) {
		delete oidcOptions.features.registration.policies;
	}

	return oidcOptions;
}

function oidcWrapper(tenant) {
	const options = oidcConfig(tenant);
	const oidc = new Provider(`${config.PROTOCOL}://${config.SWAGGER}/${tenant._id}`, options);
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

export default oidcWrapper;