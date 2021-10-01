import { v4 as uuid } from 'uuid';
import sizeof from 'object-sizeof';
import Account from '../accounts/accountOidcInterface';
import access from '../accounts/access';
import middle from '../../oidcMiddleware';
import intApi from './interactions/api';
import IAT from './models/initialAccessToken';
import UEProvider from './ueProvider';
const bodyParser = require('koa-bodyparser');
const config = require('../../config');
const MongoAdapter = require('./dal');
const cors = require('koa2-cors');

const coreScopes = config.CORE_SCOPES();
const ueP = new UEProvider();

const {
	errors: { InvalidClientMetadata, AccessDenied, OIDCProviderError, InvalidRequest },
} = require('oidc-provider');

const ACCESS_SCOPES = [
	'access',
	'access:group',
	'access:organizations',
	'access:products',
	'access:roles',
	'access:permissions'
];
const BASE_SCOPES = [
	'openid',
	'offline_access'].concat(ACCESS_SCOPES);

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
		scopes: BASE_SCOPES.concat(coreScopes).concat(g.config.scopes),
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
				logoutSource: intApi.logoutSource,
				postLogoutSuccessSource: intApi.postLogoutSuccessSource
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
						scope: BASE_SCOPES.concat(coreScopes).concat(g.config.scopes).join(' ')
					};
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
			// backing up claim before attempting access inclusion
			const backup = JSON.parse(JSON.stringify(claims));
			// getting access information for the user
			try {
				const scopes = token.scope.split(' ');
				let bAccess = false;
				scopes.map((s) => {
					if(ACCESS_SCOPES.includes(s)) {
						bAccess = true;
					}
				});
				const query = {
					minimized: true
				};
				if(ctx.oidc.body.x_access_filter_organization){
					query.org = ctx.oidc.body.x_access_filter_organization;
				}
				if(ctx.oidc.body.x_access_filter_domain){
					query.domain = ctx.oidc.body.x_access_filter_domain;
				}
				if(ctx.oidc.body.x_access_filter_product){
					query.product = ctx.oidc.body.x_access_filter_product;
				}
				if(bAccess === true && ctx.authGroup) {
					const userAccess = await access.getUserAccess(ctx.authGroup, token.accountId, query);
					if(token.format === 'jwt' && sizeof(userAccess) > config.ACCESS_OBJECT_SIZE_LIMIT) {
						const url = `${config.PROTOCOL}://${config.SWAGGER}/api/${ctx.authGroup.id}/access/validate`;
						let urlQuery = '?';
						if(query.org) urlQuery = `${urlQuery}org=${query.org}`;
						if(query.domain) {
							urlQuery = (urlQuery === '?') ? `${urlQuery}domain=${query.domain}` : `&${urlQuery}domain=${query.domain}`;
						}
						if(query.product) {
							urlQuery = (urlQuery === '?') ? `${urlQuery}product=${query.product}` : `&${urlQuery}product=${query.product}`;
						}
						claims['x-access-url'] = (urlQuery === '?') ? url : `${url}${urlQuery}`;
						claims['x-access-method'] = 'GET';
					} else {
						if(userAccess) {
							if(userAccess.owner === true && (scopes.includes('access') || scopes.includes('access:group'))) {
								claims['x-access-group'] = 'owner';
							}
							if(userAccess.member === true && (scopes.includes('access') || scopes.includes('access:group'))) {
								if(!claims['x-access-group']) claims['x-access-group'] = 'member';
								else claims['x-access-group'] = (`${claims['x-access-group']} member`).trim();
							}
							if(userAccess.orgs && (scopes.includes('access') || scopes.includes('access:organizations'))) {
								claims['x-access-organizations'] = userAccess.orgs;
							}
							if(userAccess.products && (scopes.includes('access') || scopes.includes('access:products'))) {
								claims['x-access-products'] = userAccess.products;
							}
							if(userAccess.productRoles && (scopes.includes('access') || scopes.includes('access:roles'))) {
								claims['x-access-roles'] = userAccess.productRoles;
							}
							if(userAccess.permissions && (scopes.includes('access') || scopes.includes('access:permissions'))) {
								claims['x-access-permissions'] = userAccess.permissions;
							}
						}
					}
				}
			} catch (e) {
				console.error(e);
				claims = backup;
			}
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
		renderError: intApi.renderError,
		ttl: {
			AccessToken: g.config.ttl.accessToken,
			AuthorizationCode: g.config.ttl.authorizationCode,
			ClientCredentials: g.config.ttl.clientCredentials,
			DeviceCode: g.config.ttl.deviceCode,
			IdToken: g.config.ttl.idToken,
			RefreshToken: g.config.ttl.refreshToken,
			Interaction: g.config.ttl.interaction,
			Session: g.config.ttl.session,
			Grant: g.config.ttl.grant,
		},
		allowOmittingSingleRegisteredRedirectUri: true,
		pkce: {
			required: () => g.config.pkceRequired,
		}
	};

	// make sure we've activated initial access token correctly
	if(oidcOptions.features &&
		oidcOptions.features.registration &&
		oidcOptions.features.registration.initialAccessToken === false) {
		delete oidcOptions.features.registration.policies;
	}
	return oidcOptions;
}

const corsOptions = {
	origin: function(ctx) {
		//can get more restrictive later
		return '*';
	},
	allowMethods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
};

function oidcWrapper(tenant) {
	const options = oidcConfig(tenant);
	const issuer = `${config.PROTOCOL}://${config.SWAGGER}/${tenant._id}`;
	const oidc = ueP.find(tenant, issuer, options);
	oidc.proxy = true;
	oidc.use(bodyParser());
	oidc.use(cors(corsOptions));
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