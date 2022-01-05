import oidc from '../oidc';
import { generators } from 'openid-client';
import Account from '../../accounts/accountOidcInterface';
import {say} from '../../../say';
import acc from '../../accounts/account';
import iat from '../initialAccess/iat';
import interactions from './interactions';
import n from '../../plugins/notifications/notifications';
import Boom from '@hapi/boom';
import Pug from 'koa-pug';
import path from 'path';
import crypto from 'crypto';
const config = require('../../../config');
const querystring = require('querystring');
const { inspect } = require('util');
const isEmpty = require('lodash/isEmpty');
const { strict: assert } = require('assert');

const {
	errors: { OIDCProviderError },
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

export default {
	async getInt(req, res, next) {
		try {
			const provider = await oidc(req.authGroup, req.customDomain);
			const intDetails = await provider.interactionDetails(req, res);
			const { uid, prompt, params, session } = intDetails;
			params.passwordless = false;
			if (req.authGroup.pluginOptions.notification.enabled === true &&
			req.globalSettings.notifications.enabled === true) {
				params.passwordless = (req.authGroup &&
					req.authGroup.config &&
					req.authGroup.config.passwordLessSupport === true);
			}

			const client = await provider.Client.find(params.client_id);
			if(client.auth_group !== req.authGroup.id) {
				throw Boom.forbidden('The specified login client is not part of the indicated auth group');
			}
			switch (prompt.name) {
			case 'login': {
				return res.render('login', interactions.standardLogin(req.authGroup, client, debug, prompt, session, uid, params));
			}
			case 'consent': {
				if(client.client_skip_consent === true) {
					const result = await interactions.confirmAuthorization(provider, intDetails, req.authGroup);
					return provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
				}
				return res.render('interaction', interactions.consentLogin(req.authGroup, client, debug, session, prompt, uid, params));
			}
			default:
				return undefined;
			}
		} catch (err) {
			return next(err);
		}
	},

	async passwordless (req, res, next) {
		try {
			const provider = await oidc(req.authGroup, req.customDomain);
			const { uid, prompt, params, session } = await provider.interactionDetails(req, res);
			const client = await provider.Client.find(params.client_id);
			if(client.auth_group !== req.authGroup.id) {
				throw Boom.forbidden('The specified login client is not part of the indicated auth group');
			}
			params.passwordless = false;
			if (req.authGroup.pluginOptions.notification.enabled === true &&
				req.globalSettings.notifications.enabled === true) {
				params.passwordless = (req.authGroup &&
					req.authGroup.config &&
					req.authGroup.config.passwordLessSupport === true);
			}

			if (params.passwordless === false ||
				req.authGroup.pluginOptions.notification.enabled === false ||
				req.globalSettings.notifications.enabled === false) {
				return res.render('login', interactions.standardLogin(req.authGroup, client, debug, prompt, session, uid, params, 'Passwordless authentication is not enabled, please use another method.'));
			}
			return res.render('passwordless', interactions.pwdlessLogin(req.authGroup, client, debug, prompt, session, uid, params));
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
			const client = await provider.Client.find(params.client_id);
			if(client.auth_group !== req.authGroup.id) {
				throw Boom.forbidden('The specified login client is not part of the indicated auth group');
			}
			params.passwordless = false;
			if (req.authGroup.pluginOptions.notification.enabled === true &&
				req.globalSettings.notifications.enabled === true) {
				params.passwordless = (req.authGroup &&
					req.authGroup.config &&
					req.authGroup.config.passwordLessSupport === true);
			}
			const account = await acc.getAccount(req.authGroup.id, id);
			const tok = await iat.getOne(iAccessToken, req.authGroup.id);
			let token;
			if (tok) {
				token = JSON.parse(JSON.stringify(tok));
			}

			if (!account ||
				account.authGroup !== req.authGroup.id ||
				!token ||
				!token.payload ||
				token.payload.sub !== id ||
				token.payload.email !== account.email ||
				token.payload.uid !== uid) {
				return res.render('login', interactions.standardLogin(req.authGroup, client, debug, prompt, session, uid, { ...params, login_hint: req.body.email }, 'Invalid credentials. Your password free link may have expired.'));
			}

			// clean up
			await iat.deleteOne(iAccessToken, req.authGroup.id);

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
			const nonce = res.locals.cspNonce;
			const spec = req.params.spec;
			const provider = req.params.provider;
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
			if(req.body.upstream) {
				const upstream = req.body.upstream.split('.');
				const {spec, provider, name, myConfig} = await checkProvider(upstream, req.authGroup);
				const redirectUri = `${req.provider.issuer}/interaction/callback/${spec.toLowerCase()}/${provider.toLowerCase()}/${name.toLowerCase().replace(/ /g, '_')}`;
				const openid = require('openid-client');
				const google = await openid.Issuer.discover(myConfig.discovery_url);
				const clientOptions = {
					client_id: myConfig.client_id,
					response_types: [myConfig.response_type],
					redirect_uris: [redirectUri],
					grant_types: [myConfig.grant_type]
				};
				if(myConfig.PKCE === false) {
					clientOptions.client_secret = myConfig.client_secret;
				} else {
					clientOptions.token_endpoint_auth_method = 'none';
				}

				const client = new google.Client(clientOptions);
				req.provider.app.context.google = client;
				req.authIssuer = google;
				req.authClient = client;
				req.authSpec = spec;
				req.fedConfig = myConfig;
			}
			return next();
		} catch (error) {
			next(error);
		}
	},
	async federated(req, res, next) {
		try {
			const provider = req.provider;
			const { prompt: { name } } = await provider.interactionDetails(req, res);
			assert.equal(name, 'login');
			const path = `/${req.authGroup.id}/interaction/${req.params.uid}/federated`;
			switch (req.authSpec.toLowerCase()) {
			case 'oidc': {
				const callbackParams = req.authClient.callbackParams(req);
				const myConfig = req.fedConfig;
				const callbackUrl = `${req.provider.issuer}/interaction/callback/oidc/${myConfig.provider.toLowerCase()}/${myConfig.name.toLowerCase().replace(/ /g, '_')}`;
				if (!Object.keys(callbackParams).length) {
					const state = `${req.params.uid}|${crypto.randomBytes(32).toString('hex')}`;
					const nonce = crypto.randomBytes(32).toString('hex');
					res.cookie(`${myConfig.provider}.${myConfig.name.replace(/ /g, '_')}.state`, state, { path, sameSite: 'strict' });
					res.cookie(`${myConfig.provider}.${myConfig.name.replace(/ /g, '_')}.nonce`, nonce, { path, sameSite: 'strict' });
					res.status = 303;
					const authUrlOptions = {
						state,
						nonce,
						scope: `openid email ${myConfig.scopes.join(' ')}`.trim()
					};
					if(myConfig.PKCE === true) {
						const code_verifier = generators.codeVerifier();
						const code_challenge = generators.codeChallenge(code_verifier);
						await interactions.savePKCESession({
							payload: {
								state,
								auth_group: req.authGroup.id,
								code_challenge,
								code_verifier
							}
						});
						authUrlOptions.code_challenge = code_challenge;
						authUrlOptions.code_challenge_method = 'S256';
					}

					return res.redirect(req.authClient.authorizationUrl(authUrlOptions));
				}
				// callback
				const state = req.cookies[`${myConfig.provider}.${myConfig.name.replace(/ /g, '_')}.state`];
				res.cookie(`${myConfig.provider}.${myConfig.name.replace(/ /g, '_')}.state`, null, { path });
				const nonce = req.cookies[`${myConfig.provider}.${myConfig.name.replace(/ /g, '_')}.nonce`];
				res.cookie(`${myConfig.provider}.${myConfig.name.replace(/ /g, '_')}.nonce`, null, { path });
				const callbackOptions = {
					state,
					nonce,
					response_type: myConfig.response_type
				};
				if(myConfig.PKCE === true) {
					const session = await interactions.getPKCESession(req.authGroup.id, state);
					if(!session) throw Boom.badRequest('PKCE Session not found');
					callbackOptions.code_verifier = session.payload.code_verifier;
				}
				const tokenSet = await req.authClient.callback(callbackUrl, callbackParams, callbackOptions);
				const profile = await req.authClient.userinfo(tokenSet);
				const account = await Account.findByFederated(req.authGroup,
					`${myConfig.spec}.${myConfig.provider}.${myConfig.name.replace(/ /g, '_')}`,
					profile);
				const result = {
					login: {
						accountId: account.accountId,
					},
				};
				return provider.interactionFinished(req, res, result, {
					mergeWithLastSubmission: false,
				});
			}
			default:
				throw Boom.badRequest('Unknown Federation Specification');
			}
		} catch (err) {
			next(err);
		}
	},
	async login(req, res, next) {
		try {
			const provider = await oidc(req.authGroup, req.customDomain);
			const { uid, prompt, params, session } = await provider.interactionDetails(req, res);
			params.passwordless = false;
			if (req.authGroup.pluginOptions.notification.enabled === true &&
				req.globalSettings.notifications.enabled === true) {
				params.passwordless = (req.authGroup &&
					req.authGroup.config &&
					req.authGroup.config.passwordLessSupport === true);
			}

			// email will check against username as well... todo do we want to control that?
			// in v7 this is referred to as findByLogin
			const accountId = await Account.authenticate(req.authGroup, req.body.email, req.body.password);

			// if there is a problem, go back to login...
			if (!accountId) {
				const client = await provider.Client.find(params.client_id);
				if(client.auth_group !== req.authGroup.id) {
					throw Boom.forbidden('The specified login client is not part of the indicated auth group');
				}
				return res.render('login', interactions.standardLogin(req.authGroup, client, debug, prompt, session, uid, { ...params, login_hint: req.body.email }, 'Invalid email or password.'));
			}

			const result = {
				login: {
					accountId
				},
			};

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
			if (req.authGroup.pluginOptions.notification.enabled === true &&
				req.globalSettings.notifications.enabled === true) {
				params.passwordless = (req.authGroup &&
					req.authGroup.config &&
					req.authGroup.config.passwordLessSupport === true);
			} else {
				return res.render('login', interactions.standardLogin(req.authGroup, client, debug, prompt, session, uid, { ...params, login_hint: req.body.email }, 'Password free login is not available at this time.'));
			}
			const account = await acc.getAccountByEmailOrUsername(req.authGroup.id, req.body.email);
			if (!account) {
				return res.render('login', interactions.standardLogin(req.authGroup, client, debug, prompt, session, uid, { ...params, login_hint: req.body.email }, 'Invalid email or password.'));
			}
			const meta = {
				auth_group: req.authGroup.id,
				sub: account.id,
				email: account.email,
				uid
			};
			iAccessToken = await iat.generateIAT(900, ['auth_group'], req.authGroup, meta);
			const notificationData = interactions.passwordLessOptions(req.authGroup, account, iAccessToken, [], uid, req.customDomain);
			await n.notify(req.globalSettings, notificationData, req.authGroup);
			return res.render('success', {
				title: 'SUCCESS!',
				message: 'You should have a password free login link in your email or text messages. You may close this window.'
			});
		} catch (err) {
			if(iAccessToken) {
				await iat.deleteOne(iAccessToken.jti, req.authGroup.id);
			}
			if (_uid && client && _params) {
				return res.render('login', interactions.standardLogin(req.authGroup, client, debug, _prompt, _session, _uid, { ..._params, login_hint: req.body.email }, 'Password free login is not available right now. You can try traditional login or come back later.'));
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
	async forgot (req, res, next) {
		try {
			const newPassword = req.body.password;
			const update = [
				{
					op: 'replace',
					path: '/password',
					value: newPassword
				},
				{
					op: 'replace',
					path: '/verified',
					value: true
				}
			];
			await acc.patchAccount(req.authGroup, req.user.sub, update, req.user.sub, true);
			return res.respond(say.noContent('Password Reset'));
		} catch (err) {
			next (err);
		}
	},

	async verifyAccountScreen (req, res, next) {
		try {
			if(!req.query.code) {
				if(req.query.email) {
					return res.render('error', {
						title: 'Sent Password Reset',
						message: 'Looks like successfully sent your password reset link.',
						details: 'Check your email or mobile device.'
					});
				}
				return res.render('error', {
					title: 'Uh oh...',
					message: 'Invalid Verify Account Request',
					details: 'This page requires special access. Check your email or mobile device for the link.'
				});

			}
			return res.render('verify', interactions.verifyScreen(req.authGroup, req.query, req.customDomain, req.customDomainUI));
		} catch (err) {
			next (err);
		}
	},

	async forgotPasswordScreen (req, res, next) {
		try {
			if(!req.query.code) {
				if(req.query.email) {
					return res.render('error', {
						title: 'Resent Password Reset',
						message: 'Looks like successfully resent your password reset link.',
						details: 'Check your email or mobile device.'
					});
				}
				if(!req.globalSettings || !req.globalSettings.notifications || req.globalSettings.notifications.enabled !== true)
				{
					return res.render('error', {
						title: 'Forgot Password Not Enabled by the OP Admin',
						message: 'This UE Auth instance has not activated the global notifications plugin. This is required before secure password resets are allowed through self service.',
						details: 'Please contact your UE Auth Admin.'
					});
				}
				if(!req.authGroup || !req.authGroup.pluginOptions || !req.authGroup.pluginOptions.notification || req.authGroup.pluginOptions.notification.enabled !== true || !req.authGroup.config || req.authGroup.config.centralPasswordReset !== true) {
					return res.render('error', {
						title: `Forgot Password Not Enabled for ${(req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name}`,
						message: 'This Auth Group has either not enabled notifications or has disabled centralized password reset.',
						details: `Please contact the ${(req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name} admin.`
					});
				}

			}
			return res.render('forgot', interactions.forgotScreen(req.authGroup, req.query, req.customDomain, req.customDomainUI));
		} catch (err) {
			next (err);
		}
	},
	// Koa controllers or OIDC library
	async logoutSource(ctx, form) {
		try {
			const action = ctx.oidc.urlFor('end_session_confirm');
			let skipPrompt = false;
			if (ctx.req.query && ctx.req.query.skipPrompt && ctx.req.query.skipPrompt === 'true') {
				// this must be set at the client level and only works if there is a redirectUrl present
				if (ctx.oidc && ctx.oidc.client && ctx.oidc.client.client_optional_skip_logout_prompt === true) {
					// post_logout_redirect_uri further requires an id_token_hint or client_id
					if(ctx.req.query.post_logout_redirect_uri) {
						skipPrompt = true;
					}
				}
			}
			const name = (ctx.oidc && ctx.oidc.client && ctx.oidc.client.clientName) ? ctx.oidc.client.clientName : ctx.authGroup.name;
			const pug = new Pug({
				viewPath: path.resolve(__dirname, '../../../../views'),
				basedir: 'path/for/pug/extends',
			});
			const options = await interactions.oidcLogoutSourceOptions(ctx.authGroup, name, action, ctx.oidc.session.state.secret, skipPrompt);

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
				options.assets = config.STATIC_ASSETS;
				if(config.CUSTOM_FONTS_URL) {
					options.customFonts = config.CUSTOM_FONTS_URL;
				}
				ctx.body = await pug.render('logout', options);
			}
		} catch (error) {
			throw new OIDCProviderError(error.message);
		}
	},
	async postLogoutSuccessSource(ctx) {
		const {
			clientName, clientUri, initiateLoginUri, logoUri, policyUri, tosUri,
		} = ctx.oidc.client || {}; // client is defined if the user chose to stay logged in with the OP
		const name = (clientName) ? clientName : ctx.authGroup.name;
		const pug = new Pug({
			viewPath: path.resolve(__dirname, '../../../../views'),
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
		options.assets = config.STATIC_ASSETS;
		if(config.CUSTOM_FONTS_URL) {
			options.customFonts = config.CUSTOM_FONTS_URL;
		}
		ctx.body = await pug.render('logoutSuccess', options);
	},
	async renderError(ctx, out, error) {
		console.error(error);
		const pug = new Pug({
			viewPath: path.resolve(__dirname, '../../../../views'),
			basedir: 'path/for/pug/extends',
		});
		ctx.type = 'html';
		const options = await interactions.oidcRenderErrorOptions(ctx.authGroup, out);
		options.assets = config.STATIC_ASSETS;
		if(config.CUSTOM_FONTS_URL) {
			options.customFonts = config.CUSTOM_FONTS_URL;
		}
		ctx.body = await pug.render('error', options);
	}
};

async function checkProvider(upstream, authGroup) {
	if (upstream.length !== 3) throw Boom.badData(`Unknown upstream: ${upstream}`);
	const spec = upstream[0];
	const provider = upstream[1];
	const name = upstream[2].replace(/_/g, ' ');
	let agSpecs = [];
	if(authGroup.config && authGroup.config.federate) {
		Object.keys(authGroup.config.federate).map((key) => {
			if(key.toLowerCase() === spec.toLowerCase()) {
				agSpecs = authGroup.config.federate[key];
			}
		});
	}

	if(agSpecs.length === 0) {
		throw Boom.badData(`Unsupported spec ${spec} or provider ${provider}`);
	}

	const option = agSpecs.filter((config) => {
		return (config.provider.toLowerCase() === provider.toLowerCase() && config.name.toLowerCase() === name.toLowerCase());
	});
	if(option.length === 0) throw Boom.badData(`Unsupported provider with name: ${name}`);
	return { spec, provider, name, myConfig: option[0]};
}