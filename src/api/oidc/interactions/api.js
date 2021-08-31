import oidc from '../oidc';
import Account from '../../accounts/accountOidcInterface';
import {say} from '../../../say';
import acc from '../../accounts/account';
import iat from '../initialAccess/iat';
import interactions from './interactions';
import n from '../../plugins/notifications/notifications';
import Boom from '@hapi/boom';
const config = require('../../../config');
const querystring = require('querystring');
const { inspect } = require('util');
const isEmpty = require('lodash/isEmpty');
const { strict: assert } = require('assert');

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
			const provider = await oidc(req.authGroup);
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
			const provider = await oidc(req.authGroup);
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
				return res.render('login', interactions.standardLogin(req.authGroup, client, debug, prompt, session, uid, params, 'Passwordless authentication is not enabled, please use another method.'))
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
			const provider = await oidc(req.authGroup);
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

	async login(req, res, next) {
		try {
			const provider = await oidc(req.authGroup);
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
			const provider = await oidc(req.authGroup);
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
			const notificationData = interactions.passwordLessOptions(req.authGroup, account, iAccessToken, [], uid);
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
			const provider = await oidc(req.authGroup);
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
			await oidc(req.authGroup).interactionFinished(req, res, result, { mergeWithLastSubmission: false });
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
			await acc.patchAccount(req.authGroup.id, req.user.sub, update, req.user.sub);
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
			return res.render('verify', interactions.verifyScreen(req.authGroup, req.query));
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
						title: `Forgot Password Not Enabled by the OP Admin`,
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
			return res.render('forgot', interactions.forgotScreen(req.authGroup, req.query));
		} catch (err) {
			next (err);
		}
	}
};