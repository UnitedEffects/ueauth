import oidc from '../oidc';
import Account from '../../accounts/accountOidcInterface';
import {say} from '../../../say';
import acc from '../../accounts/account';
import iat from '../initialAccess/iat';
import interactions from './interactions';
import n from '../../plugins/notifications/notifications';
const config = require('../../../config');
const querystring = require('querystring');
const { inspect } = require('util');
const isEmpty = require('lodash/isEmpty');
const { strict: assert } = require('assert');

/**
 *
 * FIX FOR BODYPARSE DEPRICATION
 * const { urlencoded } = require('express'); // eslint-disable-line import/no-unresolved
 */
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
			const details = await oidc(req.authGroup).interactionDetails(req, res);
			const { uid, prompt, params, session } = details;
			params.passwordless = false;
			if (req.authGroup.pluginOptions.notification.enabled === true &&
			req.globalSettings.notifications.enabled === true) {
				params.passwordless = (req.authGroup &&
					req.authGroup.config &&
					req.authGroup.config.passwordLessSupport === true);
			}

			//todo client should be specific to authGroup as well...
			const client = await oidc(req.authGroup).Client.find(params.client_id);

			switch (prompt.name) {
			case 'login': {
				return res.render('login', {
					client,
					authGroup: req.authGroup._id,
					authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
					uid,
					tos: req.authGroup.primaryTOS,
					policy: req.authGroup.primaryPrivacyPolicy,
					details: prompt.details,
					params,
					title: 'Sign-in',
					session: session ? debug(session) : undefined,
					flash: undefined,
					dbg: {
						params: debug(params),
						prompt: debug(prompt)
					}
				});
			}
			case 'consent': {
				return res.render('interaction', {
					client,
					uid,
					authGroup: req.authGroup._id,
					authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
					details: prompt.details,
					tos: req.authGroup.primaryTOS,
					policy: req.authGroup.primaryPrivacyPolicy,
					params,
					title: 'Authorize',
					session: session ? debug(session) : undefined,
					dbg: {
						params: debug(params),
						prompt: debug(prompt)
					}
				});
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
			const { uid, prompt, params, session } = await oidc(req.authGroup).interactionDetails(req, res);
			const client = await oidc(req.authGroup).Client.find(params.client_id);
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
				return res.render('login', {
					client,
					authGroup: req.authGroup._id,
					authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
					uid,
					details: prompt.details,
					tos: req.authGroup.primaryTOS,
					policy: req.authGroup.primaryPrivacyPolicy,
					params,
					title: 'Sign-in',
					flash: 'Passwordless authentication is not enabled, please use another method.',
					session: session ? debug(session) : undefined,
					dbg: {
						params: debug(params),
						prompt: debug(prompt)
					}
				});
			}
			return res.render('passwordless', {
				client,
				authGroup: req.authGroup._id,
				authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
				uid,
				details: prompt.details,
				tos: req.authGroup.primaryTOS,
				policy: req.authGroup.primaryPrivacyPolicy,
				params,
				title: 'Sign-in Password Free',
				session: session ? debug(session) : undefined,
				flash: undefined,
				dbg: {
					params: debug(params),
					prompt: debug(prompt)
				}
			});
		} catch (err) {
			return next(err);
		}
	},

	async noPassLogin(req, res, next) {
		try {
			const iAccessToken = req.query.token;
			const id = req.query.sub;
			const { uid, prompt, params, session } = await oidc(req.authGroup).interactionDetails(req, res);
			const client = await oidc(req.authGroup).Client.find(params.client_id);
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
				res.render('login', {
					client,
					uid,
					authGroup: req.authGroup._id,
					authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
					details: prompt.details,
					params: {
						...params,
						login_hint: req.body.email,
					},
					title: 'Sign-in',
					tos: req.authGroup.primaryTOS,
					policy: req.authGroup.primaryPrivacyPolicy,
					flash: 'Invalid credentials. Your password free link may have expired.',
					session: session ? debug(session) : undefined,
					dbg: {
						params: debug(params),
						prompt: debug(prompt)
					}
				});
				return;
			}

			// clean up
			await iat.deleteOne(iAccessToken, req.authGroup.id);

			const result = {
				login: {
					accountId: account.id,
				},
			};
			await oidc(req.authGroup).interactionFinished(req, res, result, { mergeWithLastSubmission: false });
		} catch (err) {
			next(err);
		}
	},

	async login(req, res, next) {
		try {
			const { uid, prompt, params, session } = await oidc(req.authGroup).interactionDetails(req, res);
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
				const client = await oidc(req.authGroup).Client.find(params.client_id);
				res.render('login', {
					client,
					uid,
					authGroup: req.authGroup._id,
					authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
					details: prompt.details,
					params: {
						...params,
						login_hint: req.body.email,
					},
					title: 'Sign-in',
					flash: 'Invalid email or password.',
					tos: req.authGroup.primaryTOS,
					policy: req.authGroup.primaryPrivacyPolicy,
					session: session ? debug(session) : undefined,
					dbg: {
						params: debug(params),
						prompt: debug(prompt)
					}
				});
				return;
			}

			const result = {
				login: {
					accountId
				},
			};

			await oidc(req.authGroup).interactionFinished(req, res, result, { mergeWithLastSubmission: false });
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
			const { uid, prompt, params, session } = await oidc(req.authGroup).interactionDetails(req, res);
			_uid = uid;
			_params = params;
			_session = session;
			_prompt = prompt;
			client = await oidc(req.authGroup).Client.find(params.client_id);
			params.passwordless = false;
			if (req.authGroup.pluginOptions.notification.enabled === true &&
				req.globalSettings.notifications.enabled === true) {
				params.passwordless = (req.authGroup &&
					req.authGroup.config &&
					req.authGroup.config.passwordLessSupport === true);
			} else {
				return res.render('login', {
					client,
					uid,
					authGroup: req.authGroup._id,
					authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
					details: prompt.details,
					params: {
						...params,
						login_hint: req.body.email,
					},
					title: 'Sign-in',
					flash: 'Password free login is not available at this time.',
					tos: req.authGroup.primaryTOS,
					policy: req.authGroup.primaryPrivacyPolicy,
					session: session ? debug(session) : undefined,
					dbg: {
						params: debug(params),
						prompt: debug(prompt)
					}
				});
			}
			const account = await acc.getAccountByEmailOrUsername(req.authGroup.id, req.body.email);
			if (!account) {
				return res.render('login', {
					client,
					uid,
					authGroup: req.authGroup._id,
					authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
					details: prompt.details,
					params: {
						...params,
						login_hint: req.body.email,
					},
					title: 'Sign-in',
					flash: 'Invalid email or password.',
					tos: req.authGroup.primaryTOS,
					policy: req.authGroup.primaryPrivacyPolicy,
					session: session ? debug(session) : undefined,
					dbg: {
						params: debug(params),
						prompt: debug(prompt)
					}
				});
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
				return res.render('login', {
					client,
					_uid,
					authGroup: req.authGroup._id,
					authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
					details: _prompt.details,
					params: {
						..._params,
						login_hint: req.body.email,
					},
					title: 'Sign-in',
					flash: 'Password free login is not available right now. You can try traditional login or come back later.',
					tos: req.authGroup.primaryTOS,
					policy: req.authGroup.primaryPrivacyPolicy,
					session: _session ? debug(_session) : undefined,
					dbg: {
						params: debug(_params),
						prompt: debug(_prompt)
					}
				});
			}
			return next(err);
		}
	},

	async confirm (req, res, next) {
		try {
			const interactionDetails = await oidc(req.authGroup).interactionDetails(req, res);
			const { prompt: { name, details }, params, session: { accountId } } = interactionDetails;
			assert.equal(name, 'consent');

			let { grantId } = interactionDetails;
			let grant;

			if (grantId) {
				grant = await oidc(req.authGroup).Grant.find(grantId);
			} else {
				grant = new (oidc(req.authGroup).Grant)({
					accountId,
					clientId: params.client_id
				});
			}
			if (details.missingOIDCScope) {
				grant.addOIDCScope(details.missingOIDCScope.join(' '));
			}
			if (details.missingOIDCClaims) {
				grant.addOIDCClaims(details.missingOIDCClaims);
			}
			if (details.missingResourceScopes) {
				// eslint-disable-next-line no-restricted-syntax
				for (const [indicator, scopes] of Object.entries(details.missingResourceScopes)) {
					grant.addResourceScope(indicator, scopes.join(' '));
				}
			}

			grantId = await grant.save();

			const consent = {};
			if (!interactionDetails.grantId) {
				// we don't have to pass grantId to consent, we're just modifying existing one
				consent.grantId = grantId;
			}

			const result = { consent };
			await oidc(req.authGroup).interactionFinished(req, res, result, { mergeWithLastSubmission: true });
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
			return res.render('verify', {
				authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
				title: 'Verify And Claim Your Account',
				iat: req.query.code,
				redirect: req.query.redirect || req.authGroup.primaryDomain || undefined,
				flash: 'Verification requires you to reset your password. Type the new one and confirm.',
				url: `${config.PROTOCOL}://${config.SWAGGER}/${req.authGroup._id}/setpass`,
				retryUrl: `${config.PROTOCOL}://${config.SWAGGER}/api/${req.authGroup._id}/operations/user/reset-password`
			});
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
				return res.render('error', {
					title: 'Uh oh...',
					message: 'Invalid Reset Password Request',
					details: 'This page requires special access. Check your email or mobile device for the link.'
				});

			}
			return res.render('forgot', {
				authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
				title: 'Forgot Password',
				iat: req.query.code,
				redirect: req.query.redirect || req.authGroup.primaryDomain || undefined,
				flash: 'Type in your new password to reset',
				url: `${config.PROTOCOL}://${config.SWAGGER}/${req.authGroup._id}/setpass`,
				retryUrl: `${config.PROTOCOL}://${config.SWAGGER}/api/${req.authGroup._id}/operations/user/reset-password`
			});
		} catch (err) {
			next (err);
		}
	}
};