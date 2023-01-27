import oidc from '../oidc';
import Account from '../../accounts/accountOidcInterface';
import acc from '../../accounts/account';
import group from '../../authGroup/group';
import org from '../../orgs/orgs';
import log from '../../logging/logs';
import iat from '../initialAccess/iat';
import interactions from './interactions';
import n from '../../plugins/notifications/notifications';
import Boom from '@hapi/boom';
import Pug from 'koa-pug';
import path from 'path';
import challenges from '../../plugins/challenge/challenge';
import fed from './federation';
import { validate as uuidValidate } from 'uuid';

const config = require('../../../config');
const querystring = require('querystring');
const { inspect } = require('util');
const isEmpty = require('lodash/isEmpty');
const { strict: assert } = require('assert');

const {
	errors: { CustomOIDCProviderError },
} = require('oidc-provider');

const keys = new Set();

const debug = (obj) => querystring.stringify(Object.entries(obj).reduce((acc, [key, value]) => {
	keys.add(key);
	if (isEmpty(value)) return acc;
	acc[key] = inspect(value, { depth: null });
	return acc;
}, {}), '<br/>', ': ', {
	encodeURIComponent(value) { return keys.has(value) ? `<strong>${value}</strong>` : value; },
});

async function safeAuthGroup(ag) {
	return group.safeAuthGroup(ag);
}

const api = {
	async getInt(req, res, next) {
		try {
			const provider = await oidc(req.authGroup, req.customDomain);
			const intDetails = await provider.interactionDetails(req, res);
			const { authGroup } = await safeAuthGroup(req.authGroup);
			const { uid, prompt, params, session } = intDetails;
			params.passwordless = false;
			params.emailScreen = true;
			if (authGroup?.pluginOptions?.notification.enabled === true &&
			req.globalSettings.notifications.enabled === true) {
				params.passwordless = (authGroup?.config?.passwordLessSupport === true);
			}

			const client = JSON.parse(JSON.stringify(await provider.Client.find(params.client_id)));
			if(client.auth_group !== req.authGroup.id) {
				throw Boom.forbidden('The specified login client is not part of the indicated auth group');
			}
			switch (prompt.name) {
			case 'login': {
				if(client?.client_skip_to_federated) {
					req.provider = provider;
					if(fed.validateFedCodeExists(authGroup, client.client_skip_to_federated)) {
						const result = await fed.establishFedClient(authGroup, client.client_skip_to_federated, provider);
						fed.setFederatedReq(req, result);
						return api.federated(req, res, next);
					}
				}
				if(!params.org && client.client_allow_org_self_identify === true && authGroup) {
					params.selfIdentify = true;
					params.orgs = req.cookies[`${authGroup.id}.organizations`]?.split(',');
				}
				if(params.org && client.client_allow_org_federation === true && authGroup) {
					try {
						const organization = await org.getOrg(authGroup, params.org);
						if(organization?.ssoLimit === true) params.ssoPriority = true;
						await orgSSO(req, res, organization, params, client, authGroup);
					} catch(error) {
						console.error(error)
						log.notify('Issue with org SSO');
					}
				}
				const options = {
					...interactions.standardLogin(authGroup, client, debug, prompt, session, uid, params)
				};
				if(req.query.flash) options.flash = req.query.flash;
				return res.render('login/login', options);
			}
			case 'consent': {
				if(client.client_skip_consent === true || params.federated_redirect === true) {
					const result = await interactions.confirmAuthorization(provider, intDetails, authGroup);
					return provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
				}
				return res.render('interaction/interaction', interactions.consentLogin(authGroup, client, debug, session, prompt, uid, params));
			}
			default:
				return undefined;
			}
		} catch (err) {
			return next(err);
		}
	},

	async noPassLogin(req, res, next) {
		try {
			const iAccessToken = req.query.token;
			const id = req.query.sub;
			const provider = await oidc(req.authGroup, req.customDomain);
			const { uid, prompt, params, session } = await provider.interactionDetails(req, res);
			const { authGroup } = await safeAuthGroup(req.authGroup);
			const client = await provider.Client.find(params.client_id);
			if(client.auth_group !== authGroup.id) {
				throw Boom.forbidden('The specified login client is not part of the indicated auth group');
			}
			params.passwordless = false;
			if (authGroup?.pluginOptions?.notification?.enabled === true &&
				req.globalSettings.notifications.enabled === true) {
				params.passwordless = (authGroup?.config?.passwordLessSupport === true);
			}
			const account = await acc.getAccount(authGroup.id, id);
			const tok = await iat.getOne(iAccessToken, authGroup.id);
			let token;
			if (tok) {
				token = JSON.parse(JSON.stringify(tok));
			}

			if (!account ||
				account.authGroup !== authGroup.id ||
				!token ||
				!token.payload ||
				token.payload.sub !== id ||
				token.payload.email !== account.email ||
				token.payload.uid !== uid) {
				params.emailScreen = true;
				return res.render('login/login', interactions.standardLogin(authGroup, client, debug, prompt, session, uid, { ...params, login_hint: req.body.email }, 'Invalid credentials. Your Magic Link may have expired.'));
			}

			// clean up
			await iat.deleteOne(iAccessToken, authGroup.id);

			const result = {
				login: {
					accountId: account.id,
				},
			};
			await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
		} catch (err) {
			next(err);
		}
	},
	async callbackLogin(req, res, next) {
		try {
			// note: organization sso callbacks should be /callback/{spec}/org:org_id/${name}
			const nonce = res.locals.cspNonce;
			const spec = req.params.spec;
			let provider = req.params.provider;
			if(provider.includes('org:')) {
				//normalize provider...
				const orgId = provider.split(':')[1];
				if(!uuidValidate(orgId)) {
					const o = JSON.parse(JSON.stringify(await org.getOrg(req.authGroup.id || req.authGroup._id, orgId)));
					provider = `org:${o.id}`;
				}
			}
			const name = req.params.name;
			//validate AG
			return res.render('repost', { layout: false, upstream: `${spec}.${provider}.${name}`, nonce, authGroup: req.authGroup.id });
		} catch (error) {
			next (error);
		}
	},

	async oidcFederationClient(req, res, next) {
		try {
			if(!req.provider) req.provider = await oidc(req.authGroup, req.customDomain);
			if (req.authIssuer) return next();
			const { authGroup } = await safeAuthGroup(req.authGroup);
			let upstreamBody = req.body.upstream;
			if(!upstreamBody) {
				const spec = req.params.spec;
				const provider = req.params.provider;
				const name = req.params.name;
				upstreamBody = `${spec}.${provider}.${name}`;
			}
			if(upstreamBody) {
				const result = await fed.establishFedClient(authGroup, upstreamBody, req.provider);
				fed.setFederatedReq(req, result);
				return next();
			}
			throw Boom.badRequest('upstream data is missing');
		} catch (error) {
			console.error('ERROR', error);
			next(error);
		}
	},
	async postCallBackLogin(req, res, next) {
		try {
			const body = JSON.parse(JSON.stringify(req.body));
			// If this is a SAML post, map the RelayState to state
			if(req.body?.RelayState && !req.body?.state) {
				body.state = req.body.RelayState
			}
			let path = `${req.path}?`;
			Object.keys(body).map((key) => {
				path = `${path}${key}=${body[key]}&`;
			});
			return res.redirect(path);
		} catch (error) {
			next(error);
		}
	},
	async federated(req, res, next) {
		try {
			const provider = req.provider;
			const { authGroup } = await safeAuthGroup(req.authGroup);

			const i = await provider.Interaction.find(req.params.uid);
			i.params.federated_redirect = true;
			await i.save(authGroup.config.ttl.interaction);

			const { prompt, params } = await provider.interactionDetails(req, res);
			console.info(params);
			assert.equal(prompt.name, 'login');
			const path = `/${authGroup.id}/interaction/${req.params.uid}/federated`;
			const fedError = (error) => {
				res.redirect(`/${authGroup.id}/interaction/${req.params.uid}?flash=Security issue with federated login - ${error}. Try again later.`);
			}
			switch (req.authSpec.toLowerCase()) {
			case 'saml':
				if(req.body?.SAMLResponse) {
					// Callback
					return fed.federateSamlCb(req, res, authGroup, path, fedError);
				} else {
					// request
					return fed.federateSamlReq(req, res, path, fedError);
				}
			case 'oidc': {
				const callbackParams = req.authClient.callbackParams(req);
				if (!Object.keys(callbackParams).length) {
					// request
					return fed.federateOidcReq(req, res, authGroup, callbackParams, path, fedError);
				}
				// callback
				return fed.federateOidcCb(req, res, authGroup, path, params, fedError);
			}
			case 'oauth2':
				// we are only supporting authorization_code for oauth2 for now
				if(req.body && !req.body.code) {
					//request
					return fed.federateOauth2Req(req, res, authGroup, path, fedError);
				}
				//callback
				return fed.federateOauth2Cb(req, res, authGroup, path, params, fedError);
			default:
				throw Boom.badRequest('Unknown Federation Specification');
			}
		} catch (err) {
			next(err);
		}
	},
	async login(req, res, next) {
		try {
			if (req.body?.action === 'magic') return api.sendPasswordFree(req, res, next);
			const provider = await oidc(req.authGroup, req.customDomain);
			const { uid, prompt, params, session } = await provider.interactionDetails(req, res);
			params.passwordless = false;
			const { authGroup } = await safeAuthGroup(req.authGroup);
			if (authGroup?.pluginOptions?.notification?.enabled === true &&
				req.globalSettings.notifications.enabled === true) {
				params.passwordless = (authGroup?.config?.passwordLessSupport === true);
			}
			if (req.body?.action === 'orgLookup') {
				params.emailScreen = true;
				const client = JSON.parse(JSON.stringify(await provider.Client.find(params.client_id)));
				if(req.body?.organization) {
					try {
						const organization = await org.getOrg(authGroup, req.body?.organization);
						params.org = organization.id;
						if(organization.ssoLimit === true) params.ssoPriority = true;
						await orgSSO(req, res, organization, params, client, authGroup);
					} catch(error) {
						console.error(error);
						log.notify('Issue with org SSO');
					}
				}
				const options = {
					...interactions.standardLogin(authGroup, client, debug, prompt, session, uid, params)
				};
				if(req.query.flash) options.flash = req.query.flash;
				return res.render('login/login', options);
			}

			if (req.body?.action === 'email') {
				const client = JSON.parse(JSON.stringify(await provider.Client.find(params.client_id)));
				if(req.body?.email) {
					const checkAcc = await acc.getAccountByEmailOrUsername(authGroup, req.body.email);
					if(!checkAcc || (checkAcc.verified !== true && authGroup.config.requireVerified === true)) {
						// account does not exist or is not verified
						const message = (checkAcc?.verified === false) ? 'Account is not yet verified. Click the button below to resend verification email.' : 'Email not recognized...';
						params.emailScreen = true;
						params.api = `${config.PROTOCOL}://${(authGroup.aliasDnsOIDC)?authGroup.aliasDnsOIDC : config.SWAGGER}/api/${authGroup.id}`;
						if(checkAcc?.verified === false) params.sendVerifyButton = true;
						return res.render('login/login',
							interactions.standardLogin(authGroup, client, debug, prompt, session, uid,
								{
									...params,
									login_hint: req.body.email
								}, message));
					}
				}
				if (!req.body?.email) params.emailScreen = true;
				else params.email = req.body.email;
				if(client.client_allow_org_federation===true && authGroup && req.body?.email) {
					try {
						let organization;
						if(params.org || req.body?.org) {
							organization = await org.getOrg(authGroup, (params.org || req.body?.org));
						} else {
							organization = await org.getOrgBySsoEmailDomain(authGroup, req.body.email);
						}
						if(organization?.ssoLimit === true) params.ssoPriority = true;
						await orgSSO(req, res, organization, params, client, authGroup);
					} catch(error) {
						console.error(error);
						log.notify('Issue with org SSO');
					}
				}
				const options = {
					...interactions.standardLogin(authGroup, client, debug, prompt, session, uid, params)
				};
				if(req.query.flash) options.flash = req.query.flash;
				return res.render('login/login', options);
			}

			let account = {};
			if(req.body.providerKey && req.body.accountId) {
				//this is a confirmation of mfa
				const status = await challenges.status({
					accountId: req.body.accountId,
					uid,
					authGroup: authGroup.id,
					providerKey: req.body.providerKey
				});
				if(status?.state !== 'approved') account.accountId = undefined;
				else account = {
					accountId: status.accountId,
					mfaEnabled: true,
					mfaProven: true
				};
			} else{
				// in v7 this is referred to as findByLogin
				account = await Account.authenticate(authGroup, req.body.email, req.body.password);
			}
			// if there is a problem, go back to login...
			if (!account?.accountId) {
				const client = await provider.Client.find(params.client_id);
				if(client.auth_group !== authGroup.id) {
					throw Boom.forbidden('The specified login client is not part of the indicated auth group');
				}
				params.emailScreen = true;
				return res.render('login/login',
					interactions.standardLogin(authGroup, client, debug, prompt, session, uid,
						{
							...params,
							login_hint: req.body.email
						}, 'Invalid email or password.'));
			}

			const result = {
				login: {
					accountId: account?.accountId,
				},
			};

			if(authGroup?.config?.mfaChallenge?.enable !== true &&
				account?.mfaEnabled === true) {
				await log.error(`Account ${account.accountId} has MFA enabled but the operating AuthGroup ${authGroup.id} does not. The user's expectation of security may be compromised`);
			}
			if(authGroup?.config?.mfaChallenge?.enable === true &&
				account?.mfaEnabled === true &&
				account?.mfaProven !== true &&
				req.globalSettings?.mfaChallenge?.enabled === true) {
				let mfaResult;
				const meta = {
					content: {
						title: 'Authorization Request',
						header: `${authGroup.name} Platform`,
						body: 'If you initiated this login, Approve below. Otherwise click Decline and change your password.'
					}
				};
				try {
					mfaResult = await challenges.sendChallenge(authGroup, req.globalSettings, account, uid, meta);
				} catch (error) {
					console.error(error);
				}
				if(!mfaResult) throw Boom.badRequest(`The ${authGroup.name} platform now requires MFA to be enabled. We attempted to automatically do this for you but ran into an issue accessing the MFA provider. Please try again later and if the issue continues, contact the administrator.`);
				const client = await provider.Client.find(params.client_id);
				return res.render('login/login', interactions.standardLogin(authGroup, client, debug, prompt, session, uid, params, undefined,{ accountId: account.accountId, pending: true, bindUser: false, providerKey: mfaResult.id }));
			}
			if(authGroup?.config?.mfaChallenge?.enable === true &&
				authGroup?.config?.mfaChallenge?.required === true &&
				req.globalSettings?.mfaChallenge?.enabled === true &&
				account?.mfaEnabled !== true) {
				let bindData;
				let instructions;
				try {
					await challenges.revokeAllDevices(authGroup, req.globalSettings, account);
					bindData = await challenges.bindUser(authGroup, req.globalSettings, account);
					instructions = await challenges.bindInstructions(authGroup, req.globalSettings, bindData);
				} catch (error) {
					console.error(error);
				}
				if(!bindData || !instructions) throw Boom.badRequest(`The ${authGroup.name} platform now requires MFA to be enabled. We attempted to automatically do this for you but ran into an issue accessing the MFA provider. Please try again later and if the issue continues, contact the administrator.`);
				const enableMFA = await acc.enableMFA(authGroup.id, account.accountId);
				if(enableMFA !== true) throw Boom.badRequest(`The ${authGroup.name} platform now requires MFA to be enabled. We attempted to automatically do this for you but ran into an issue accessing your account. Please contact the administrator.`);
				const client = await provider.Client.find(params.client_id);
				return res.render('login/login', interactions.standardLogin(authGroup, client, debug, prompt, session, uid, params, undefined,{ accountId: account.accountId, pending: true, bindUser: true, instructions }));
			}

			await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
		} catch (err) {
			next(err);
		}
	},

	async sendPasswordFree(req, res, next) {
		let iAccessToken;
		let _uid;
		let client;
		let _params;
		let _session;
		let _prompt;
		const { authGroup, safeAG } = await safeAuthGroup(req.authGroup);
		try {
			const provider = await oidc(req.authGroup, req.customDomain);
			const { uid, prompt, params, session } = await provider.interactionDetails(req, res);
			_uid = uid;
			_params = params;
			_session = session;
			_prompt = prompt;
			client = await provider.Client.find(params.client_id);
			if(client.auth_group !== req.authGroup.id) {
				throw Boom.forbidden('The specified login client is not part of the indicated auth group');
			}
			params.passwordless = false;
			if (authGroup?.pluginOptions?.notification?.enabled === true &&
				req.globalSettings.notifications.enabled === true) {
				params.passwordless = (authGroup?.config?.passwordLessSupport === true);
			} else {
				params.emailScreen = true;
				return res.render('login/login', interactions.standardLogin(authGroup, client, debug, prompt, session, uid, { ...params, login_hint: req.body.email }, 'Magic Link login is not available at this time.'));
			}
			const account = await acc.getAccountByEmailOrUsername(authGroup.id, req.body.email);

			// ensure that we do not bypass any restrictions
			if (!account ||
				account.userLocked === true ||
				account.blocked === true ||
				account.active !== true ||
				(account.verified !== true && authGroup.config.requireVerified === true)) {
				const message = (account?.verified === false) ? 'Account is not yet verified. Click the button below to resend verification email.' : 'Invalid email address';
				params.emailScreen = true;
				params.api = `${config.PROTOCOL}://${(authGroup.aliasDnsOIDC)?authGroup.aliasDnsOIDC : config.SWAGGER}/api/${authGroup.id}`;
				if(account?.verified === false) params.sendVerifyButton = true;
				return res.render('login/login', interactions.standardLogin(authGroup, client, debug, prompt, session, uid, { ...params, login_hint: req.body.email }, message));
			}

			if(account.mfa?.enabled === true) {
				const metaChallenge = {
					event: 'MAGIC_LINK',
					content: {
						title: 'No-Password Login Request',
						header: `${authGroup.name} Platform`,
						body: 'If you initiated this Magic Link Login, Approve below. Otherwise click Decline and change your password.'
					}
				};
				await challenges.sendChallenge(authGroup, req.globalSettings, { accountId: account.id, mfaEnabled: true}, uid, metaChallenge);
			} else {
				const meta = {
					auth_group: authGroup.id,
					sub: account.id,
					email: account.email,
					uid
				};
				iAccessToken = await iat.generateIAT(900, ['auth_group'], authGroup, meta);
				const notificationData = interactions.passwordLessOptions(authGroup, account, iAccessToken, [], uid, req.customDomain);
				await n.notify(req.globalSettings, notificationData, req.authGroup);
			}
			return res.render('response/response', {
				title: 'SUCCESS!',
				message: 'You should have a password free login link in your email or text messages. If you have MFA enabled, you will need to approve the login first. You may close this window.',
				authGroupLogo: authGroup.config?.ui?.skin?.logo || undefined,
				splashImage: authGroup.config?.ui?.skin?.splashImage || undefined,
				authGroup: safeAG
			});
		} catch (err) {
			if(iAccessToken) {
				await iat.deleteOne(iAccessToken.jti, authGroup.id);
			}
			if (_uid && client && _params) {
				_params.emailScreen = true;
				return res.render('login/login', interactions.standardLogin(authGroup, client, debug, _prompt, _session, _uid, { ..._params, login_hint: req.body.email }, 'Magic Link login is not available right now. You can try traditional login or come back later.'));
			}
			return next(err);
		}
	},

	async confirm (req, res, next) {
		try {
			const provider = await oidc(req.authGroup, req.customDomain);
			const interactionDetails = await provider.interactionDetails(req, res);
			const result = await interactions.confirmAuthorization(provider, interactionDetails, req.authGroup);
			await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
		} catch (err) {
			next(err);
		}
	},
	async abort (req, res, next) {
		try {
			const result = {
				error: 'access_denied',
				error_description: 'End-User aborted interaction',
			};
			await oidc(req.authGroup, req.customDomain).interactionFinished(req, res, result, { mergeWithLastSubmission: false });
		} catch (err) {
			next(err);
		}
	},
	// Koa controllers or OIDC library
	async logoutSource(ctx, form) {
		try {
			const action = ctx.oidc.urlFor('end_session_confirm');
			let skipPrompt = false;
			if (ctx?.req?.query?.skipPrompt === 'true') {
				// this must be set at the client level and only works if there is a redirectUrl present
				if (ctx?.oidc?.client?.client_optional_skip_logout_prompt === true) {
					// post_logout_redirect_uri further requires an id_token_hint or client_id
					if(ctx?.req?.query?.post_logout_redirect_uri) {
						skipPrompt = true;
					}
				}
			}
			const name = (ctx?.oidc?.client?.clientName) ? ctx.oidc.client.clientName : ctx.authGroup.name;
			let client;
			if(ctx?.oidc?.client) {
				client = JSON.parse(JSON.stringify(ctx.oidc.client));
			}
			const pug = new Pug({
				viewPath: path.resolve(__dirname, '../../../../views'),
				basedir: 'path/for/pug/extends',
			});
			const options = await interactions.oidcLogoutSourceOptions(ctx.authGroup, name, action, ctx.oidc.session.state.secret, client, skipPrompt);
			if (ctx?.req?.query?.onCancel) {
				options.onCancel = ctx.req.query.onCancel;
			}
			if (ctx?.req?.query?.json === 'true') {
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
				options.assets = config.STATIC_ASSETS;
				if(config.CUSTOM_FONTS_URL) {
					options.customFonts = config.CUSTOM_FONTS_URL;
				}
				ctx.body = await pug.render('logout/logout', { ...options, nonce: ctx.res.locals.cspNonce });
			}
		} catch (error) {
			throw new CustomOIDCProviderError(error.message);
		}
	},
	async postLogoutSuccessSource(ctx) {
		try {
			const { authGroup } = await safeAuthGroup(ctx.authGroup);

			const clientName = (ctx.oidc.client) ? ctx.oidc.client.clientName : null;
			const clientId = (ctx.oidc.client) ? ctx.oidc.client.clientId : null;
			let clientUri = (ctx.oidc.client) ? ctx.oidc.client.clientUri : null;
			const initiateLoginUri = (ctx.oidc.client) ? ctx.oidc.client.initiateLoginUri : null;
			const logoUri = (ctx.oidc.client) ? ctx.oidc.client.logoUri : null;
			const policyUri = (ctx.oidc.client) ? ctx.oidc.client.policyUri : null;
			const tosUri = (ctx.oidc.client) ? ctx.oidc.client.tosUri : null;

			if(authGroup.associatedClient === clientId) {
				clientUri = `https://${(authGroup.aliasDnsUi) ? authGroup.aliasDnsUi : config.UI_URL}/${authGroup.prettyName}`;
			}
			const name = (clientName) ? clientName : ctx.authGroup.name;
			const pug = new Pug({
				viewPath: path.resolve(__dirname, '../../../../views'),
				basedir: 'path/for/pug/extends',
			});
			const message = (clientName) ? `You are still logged into ${name}` : undefined;
			const options = await interactions.oidcPostLogoutSourceOptions(authGroup, message, clientUri, initiateLoginUri, logoUri, policyUri, tosUri, clientName);
			ctx.type = 'html';
			ctx.set('json-data', JSON.stringify({
				title: options.title,
				message: options.message,
				authGroup: options.authGroup
			}));
			options.assets = config.STATIC_ASSETS;
			if(config.CUSTOM_FONTS_URL) {
				options.customFonts = config.CUSTOM_FONTS_URL;
			}
			ctx.body = await pug.render('logout/confirm', { ...options, nonce: ctx.res.locals.cspNonce });
		} catch (error) {
			throw new CustomOIDCProviderError(error.message);
		}
	},
	async renderError(ctx, out, error) {
		console.error(error);
		const { authGroup, safeAG } = await safeAuthGroup(ctx.authGroup);
		const pug = new Pug({
			viewPath: path.resolve(__dirname, '../../../../views'),
			basedir: 'path/for/pug/extends',
		});
		ctx.type = 'html';
		const options = await interactions.oidcRenderErrorOptions(authGroup, out, safeAG);
		options.assets = config.STATIC_ASSETS;
		if(config.CUSTOM_FONTS_URL) {
			options.customFonts = config.CUSTOM_FONTS_URL;
		}
		ctx.body = await pug.render('response/response', { ...options, nonce: ctx.res.locals.cspNonce });
	}
};

export default api;

async function orgSSO(req, res, organization, params, client, authGroup) {
	if(organization?.id) {
		let orgs = [];
		if(req.body?.clearCookies !== 'on') {
			orgs = req.cookies[`${authGroup.id}.organizations`]?.split(',');
		}
		if(!orgs?.includes((organization.alias || organization.externalId || organization.id))) {
			if(!Array.isArray(orgs)) orgs = [];
			if(orgs.length > 4) orgs.shift();
			orgs.push((organization.alias || organization.externalId || organization.id));
			res.cookie(`${authGroup.id}.organizations`, orgs.join(','), { sameSite: 'strict', overwrite: true });
		}
	}
	if(organization?.id && organization?.sso) {
		params.organization = organization;
		Object.keys(organization.sso).map((key) => {
			if(organization.sso[key]) {
				const orgSSO = JSON.parse(JSON.stringify(organization.sso[key]));
				orgSSO.provider = `org:${organization.id}`;
				const code = `${key}.${orgSSO.provider}.${orgSSO.name.replace(/ /g, '_')}`;
				if(!client.client_federation_options || organization.ssoLimit === true) {
					client.client_federation_options = [];
				}
				if(!client.client_federation_options.includes(code)) client.client_federation_options.push(code);
				if(!authGroup?.config?.federate) {
					if(!authGroup?.config) throw Boom.badImplementation('Missing configuration for AuthGroup');
					authGroup.config.federate = {
						oidc: []
					};
				}
				if(!authGroup?.config?.federate[key]) {
					authGroup.config.federate[key] = [];
				}
				authGroup.config.federate[key].push(orgSSO);
			}
		});
	}
}