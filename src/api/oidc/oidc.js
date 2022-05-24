import { v4 as uuid } from 'uuid';
import { camelCase } from 'lodash';
import sizeof from 'object-sizeof';
import Account from '../accounts/accountOidcInterface';
import userAccess from '../accounts/access';
import orgs from '../orgs/orgs';
import clientAccess from '../oidc/client/access';
import intApi from './interactions/api';
import IAT from './models/initialAccessToken';
import UEProvider from './ueProvider';
const config = require('../../config');
const MongoAdapter = require('./dal');


const coreScopes = config.CORE_SCOPES();
const ueP = new UEProvider();

const {
	errors: { InvalidClientMetadata, AccessDenied, OIDCProviderError, InvalidRequest },
} = require('oidc-provider');

const ACCESS_SCOPES = [
	'access',
	'access:group',
	'access:organizations',
	'access:domains',
	'access:products',
	'access:roles',
	'access:permissions'
];
const BASE_SCOPES = [
	'openid',
	'offline_access'].concat(ACCESS_SCOPES);

async function introspectionAllowedPolicy(ctx, client, token) {
	return !(client.introspectionEndpointAuthMethod === 'none' && token.clientId !== ctx.oidc.client.clientId);
}

async function compareJSON (obj1, obj2) {
	const ret = {};
	Object.keys(obj2).map((key) => {
		if(obj1[key] === undefined) {
			ret[key] = obj2[key];
		} else if (obj1[key] !== obj2[key]) {
			if (typeof obj1[key] === typeof obj2[key]) {
				if(Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
					let diff = false;
					obj2[key].map((item) => {
						if(!obj1[key].includes(item)) diff = true;
					});
					if(diff === true) ret[key] = obj2[key];
				} else {
					ret[key] = obj2[key];
				}
			} else ret[key] = obj2[key];
		}
	});
	return ret;
}

async function objectCamel (obj) {
	const ret = {};
	Object.keys(obj).map((key) => {
		ret[camelCase(key)] = obj[key];
	});
	return ret;
}

function oidcConfig(g, aliasDns = undefined) {
	const jwks = JSON.parse(JSON.stringify({
		keys: g.config.keys
	}));
	const oidcOptions = {
		adapter: MongoAdapter,
		clients: [],
		jwks,
		findAccount: Account.findAccount,
		async findById(ctx, sub, token) {
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
			profile: ['profile']
		},
		scopes: BASE_SCOPES.concat(coreScopes).concat(g.config.scopes),
		interactions: {
			async url(ctx, interaction) {
				if(ctx.request && ctx.request.query && ctx.request.query.org) {
					interaction.params.org = ctx.request.query.org;
					await interaction.save(g.config.ttl.interaction);
				}
				return `/${ctx.authGroup._id}/interaction/${interaction.uid}`;
			},
		},
		acrValues: g.config.acrValues || [],
		features: {
			devInteractions: {enabled: false}, //THIS SHOULD NEVER BE TRUE
			introspection: {
				enabled: true,
				allowedPolicy: introspectionAllowedPolicy
			},
			revocation: {enabled: true},
			clientCredentials: {enabled: true},
			userinfo: {enabled: true},
			backchannelLogout: {
				enabled: true,
				ack: 'draft-07'
			},
			rpInitiatedLogout: {
				enabled: true,
				logoutSource: intApi.logoutSource,
				postLogoutSuccessSource: intApi.postLogoutSuccessSource
			},
			encryption: { enabled: true },
			deviceFlow: {
				//todo customize
				enabled: g.config.deviceFlow
			},
			registration: {
				enabled: true,
				idFactory: uuid,
				initialAccessToken: true,
				policies: {
					'auth_group': async function (ctx, properties) {
						try {
							// setting default Auth Group
							if (!('auth_group' in properties)) {
								if (ctx && ctx.authGroup) {
									properties.auth_group = ctx.authGroup.id || ctx.authGroup._id;
								}
							}
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
									// we are going to let federation updates to happen regardless
									const altered = await objectCamel(JSON.parse(JSON.stringify(properties)));
									altered.auth_group = altered.authGroup;
									delete altered.authGroup;
									const changes = await compareJSON(JSON.parse(JSON.stringify(ctx.oidc.entities.Client)), altered);
									let error = false;
									Object.keys(changes).map((key) => {
										if(key !== 'clientAllowOrgFederation' && key !== 'clientFederationOptions') {
											error = true;
										}
									});
									if(error) {
										console.error('attempted to update client associated to auth-group');
										throw new AccessDenied();
									}
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
			properties: [
				'auth_group',
				'client_name',
				'client_label',
				'client_skip_consent',
				'register_url',
				'client_optional_skip_logout_prompt',
				'associated_product',
				'client_federation_options',
				'client_allow_org_federation',
				'client_allow_org_self_identify'
			],
			validator(ctx, key, value, metadata) {
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
						error.message = `${error.message} - Auth Group`;
						throw new InvalidClientMetadata(error.message);
					}
				}
				if (key === 'associated_product') {
					try {
						if(value) {
							if(typeof value !== 'string') throw new InvalidClientMetadata(`${key} must be a string uuid representing a product`);
						}
					} catch (error) {
						if (error.name === 'InvalidClientMetadata') throw error;
						error.message = `${error.message} - Associated Product`;
						throw new InvalidClientMetadata(error.message);
					}
				}
				if (key === 'client_name') {
					try {
						if (value === undefined || value === null) throw new InvalidClientMetadata(`${key} is required`);
					} catch (error) {
						if (error.name === 'InvalidClientMetadata') throw error;
						error.message = `${error.message} - Client Name`;
						throw new InvalidClientMetadata(error.message);
					}
				}
				if (key === 'client_label') {
					try {
						if(!value) value = 'login';
						if(typeof value !== 'string') throw new InvalidClientMetadata(`${key} must be a string value`);
						const validLabels = ['login', 'api', 'app', 'custom'];
						if(!validLabels.includes(value)) throw new InvalidClientMetadata(`${key} be one of: ${validLabels.join(' ')}`);
					} catch (error) {
						if (error.name === 'InvalidClientMetadata') throw error;
						error.message = `${error.message} - Client Label`;
						throw new InvalidClientMetadata(error.message);
					}
				}
				if (key === 'client_skip_consent') {
					try {
						if (value === undefined || value === null) value = false;
						if (typeof value !== 'boolean') throw new InvalidClientMetadata(`${key} must be a boolean value`);
					} catch (error) {
						if (error.name === 'InvalidClientMetadata') throw error;
						error.message = `${error.message} - Client Skip Consent`;
						throw new InvalidClientMetadata(error.message);
					}
				}
				if (key === 'client_optional_skip_logout_prompt') {
					try {
						if (value === undefined || value === null) value = false;
						if (typeof value !== 'boolean') throw new InvalidClientMetadata(`${key} must be a boolean value`);
					} catch (error) {
						if (error.name === 'InvalidClientMetadata') throw error;
						error.message = `${error.message} - Client Optional Skip Logout Prompt`;
						throw new InvalidClientMetadata(error.message);
					}
				}
				if (key === 'client_allow_org_federation') {
					try {
						if (value === undefined || value === null) value = false;
						if (typeof value !== 'boolean') throw new InvalidClientMetadata(`${key} must be a boolean value`);
					} catch (error) {
						if (error.name === 'InvalidClientMetadata') throw error;
						error.message = `${error.message} - Client Allow Org Federation`;
						throw new InvalidClientMetadata(error.message);
					}
				}
				if (key === 'client_allow_org_self_identify') {
					try {
						if (value === undefined || value === null) value = false;
						if (typeof value !== 'boolean') throw new InvalidClientMetadata(`${key} must be a boolean value`);
					} catch (error) {
						if (error.name === 'InvalidClientMetadata') throw error;
						error.message = `${error.message} - Client Allow Org Self Identification`;
						throw new InvalidClientMetadata(error.message);
					}
				}
				if (key === 'client_federation_options') {
					try {
						if (value === undefined || value === null) value = [];
						if (!Array.isArray(value)) throw new InvalidClientMetadata(`${key} must be an array`);
					} catch (error) {
						if (error.name === 'InvalidClientMetadata') throw error;
						error.message = `${error.message} - Client Federation Options`;
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
			keys: (g.config?.cookieKeys?.length) ? g.config.cookieKeys : config.COOKIE_KEYS(),
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
				if (!Array.isArray(token.scope)) {
					try {
						scope = (token.scope) ? token.scope.split(' ') : [];
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
			if(token.scope) {
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
						const organization = await orgs.getOrg(ctx.authGroup.id, ctx.oidc.body.x_access_filter_organization);
						if(organization) query.org = organization.id;
					}
					if(ctx.oidc.body.x_access_filter_domain){
						query.domain = ctx.oidc.body.x_access_filter_domain;
					}
					if(ctx.oidc.body.x_access_filter_product){
						query.product = ctx.oidc.body.x_access_filter_product;
					}
					if(bAccess === true && ctx.authGroup) {
						let access;
						if(token.accountId) {
							// user - accessToken
							access = await userAccess.getUserAccess(ctx.authGroup, token.accountId, query);
						} else {
							// client - clientCredential
							access = await clientAccess.getFormattedClientAccess(ctx.authGroup, token.clientId);
						}
						if(token.format === 'jwt' && sizeof(access) > config.ACCESS_OBJECT_SIZE_LIMIT) {
							const url = `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/api/${ctx.authGroup.id}/access/validate`;
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
							if(access) {
								if(access.owner === true && (scopes.includes('access') || scopes.includes('access:group'))) {
									claims['x-access-group'] = 'owner';
								}
								if(access.member === true && (scopes.includes('access') || scopes.includes('access:group'))) {
									if(!claims['x-access-group']) claims['x-access-group'] = 'member';
									else claims['x-access-group'] = (`${claims['x-access-group']} member`).trim();
								}
								if(access.orgs && (scopes.includes('access') || scopes.includes('access:organizations'))) {
									if(ctx.oidc.body.x_organization_context) {
										let orgContext;
										if(ctx.oidc.body.x_organization_context === ctx.oidc.body.x_access_filter_organization ||
											ctx.oidc.body.x_organization_context === query?.org) {
											if(query?.org) orgContext = query.org;
										} else {
											const org = await orgs.getOrg(ctx.authGroup.id, ctx.oidc.body.x_organization_context);
											if (!org?.id) {
												throw new InvalidRequest(`Requested x_organization_context ${ctx.oidc.body.x_organization_context} does not exist`);
											}
											orgContext = org.id;
										}
										if(orgContext) {
											if(!access.orgs.split(' ').includes(orgContext)) {
												throw new InvalidRequest(`Requesting x_organization_context to which user does not have access: ${ctx.oidc.body.x_organization_context}`);
											}
											claims['x-organization-context'] = ctx.oidc.body.x_organization_context;
										}
									}
									claims['x-access-organizations'] = access.orgs;
								}
								if(access.domains && (scopes.includes('access') || scopes.includes('access:domains'))) {
									claims['x-access-domains'] = access.domains;
								}
								if(access.products && (scopes.includes('access') || scopes.includes('access:products'))) {
									claims['x-access-products'] = access.products;
								}
								if(access.productRoles && (scopes.includes('access') || scopes.includes('access:roles'))) {
									claims['x-access-roles'] = access.productRoles;
								}
								if(access.permissions && (scopes.includes('access') || scopes.includes('access:permissions'))) {
									claims['x-access-permissions'] = access.permissions;
								}
							}
						}
					}
				} catch (e) {
					//console.error(e);
					claims = backup;
					throw e;
				}
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

function oidcWrapper(tenant, aliasDns = undefined) {
	const options = oidcConfig(tenant, aliasDns);
	if(!(tenant._id || tenant.id)) {
		throw new Error('OIDC Provider requires an Auth Group with ID');
	}
	const issuer = `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/${tenant._id||tenant.id}`;
	return ueP.find(tenant, issuer, options);
}

export default oidcWrapper;