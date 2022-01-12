import dal from './dal';

const config = require('../../../config');
const { strict: assert } = require('assert');
export default {
	passwordLessOptions(authGroup, user, iAccessToken, formats = [], uid, aliasDns = undefined) {
		const data = {
			iss: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/${authGroup.id}`,
			createdBy: `proxy-${user.id}`,
			type: 'passwordless',
			formats,
			recipientUserId: user.id,
			recipientEmail: user.email,
			recipientSms: user.txt,
			screenUrl: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/${authGroup.id}/interaction/${uid}/passwordless?token=${iAccessToken.jti}&sub=${user.id}`,
			subject: `${authGroup.prettyName} - Password Free Login`,
			message: 'You have requested a password free login. Click the link to complete your authentication. This link will expire in 15 minutes.',
		};

		if(formats.length === 0) {
			data.formats = [];
			if(user.email) data.formats.push('email');
			if(user.sms) data.formats.push('sms');
		}
		return data;
	},
	standardLogin(authGroup, client, debug, prompt, session, uid, params, flash = undefined) {
		const loginOptions = [];
		// designing for OIDC only for now, we will incorporate others as they are added
		if(authGroup.config.federate) {
			Object.keys(authGroup.config.federate).map((key) => {
				if(authGroup.config.federate[key]) {
					authGroup.config.federate[key].map((connect) => {
						loginOptions.push({
							code: `${key}.${connect.provider}.${connect.name.replace(/ /g, '_')}`.toLowerCase(),
							upstream: connect.provider,
							button: connect.buttonType,
							text: connect.buttonText
						});
					});
				}
			});
		}
		const loginButtons = loginOptions.filter((option) => {
			return (client.client_federation_options.join(' | ').toLowerCase().includes(option.code));
		});
		const altLogin = (params.passwordLess === true || loginButtons.length > 0);
		return {
			client,
			altLogin,
			loginButtons,
			bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
			bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH,
			authGroup: authGroup._id || authGroup.id,
			authGroupName: (authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : authGroup.name,
			splashImage: client.logoUrl || authGroup.config.ui.skin.splashImage || config.DEFAULT_UI_SKIN_SPLASH || undefined,
			locked: authGroup.locked,
			registerUrl: client.register_url || authGroup.registerUrl || authGroup.primaryDomain || undefined,
			uid,
			tos: authGroup.primaryTOS || authGroup.primaryDomain || undefined,
			policy: authGroup.primaryPrivacyPolicy || authGroup.primaryDomain || undefined,
			details: prompt.details,
			params,
			title: 'Sign-in',
			session: session ? debug(session) : undefined,
			flash,
			dbg: {
				params: debug(params),
				prompt: debug(prompt)
			}
		};
	},
	pwdlessLogin(authGroup, client, debug, prompt, session, uid, params, flash = undefined) {
		return {
			client,
			bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
			bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH,
			authGroup: authGroup._id,
			authGroupName: (authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : authGroup.name,
			splashImage: client.logoUrl || authGroup.config.ui.skin.splashImage || config.DEFAULT_UI_SKIN_SPLASH || undefined,
			uid,
			locked: authGroup.locked,
			registerUrl: client.register_url || authGroup.registerUrl || authGroup.primaryDomain || undefined,
			details: prompt.details,
			tos: authGroup.primaryTOS || authGroup.primaryDomain || undefined,
			policy: authGroup.primaryPrivacyPolicy || authGroup.primaryDomain || undefined,
			params,
			title: 'Sign-in Password Free',
			session: session ? debug(session) : undefined,
			flash,
			dbg: {
				params: debug(params),
				prompt: debug(prompt)
			}
		};
	},
	consentLogin(authGroup, client, debug, session, prompt, uid, params) {
		return {
			client,
			bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
			bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH,
			uid,
			authGroup: authGroup._id,
			authGroupName: (authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : authGroup.name,
			splashImage: client.logoUrl || authGroup.config.ui.skin.splashImage || config.DEFAULT_UI_SKIN_SPLASH || undefined,
			details: prompt.details,
			tos: authGroup.primaryTOS || authGroup.primaryDomain || undefined,
			policy: authGroup.primaryPrivacyPolicy || authGroup.primaryDomain || undefined,
			params,
			title: 'Authorize',
			session: session ? debug(session) : undefined,
			dbg: {
				params: debug(params),
				prompt: debug(prompt)
			}
		};
	},
	verifyScreen(authGroup, query, aliasDns = undefined, aliasUi = undefined) {
		return {
			authGroupName: (authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : authGroup.name,
			tos: authGroup.primaryTOS,
			policy: authGroup.primaryPrivacyPolicy,
			title: 'Verify And Claim Your Account',
			iat: query.code,
			redirect: query.redirect || authGroup.primaryDomain || `https://${(aliasUi) ? aliasUi : config.UI_URL}/${authGroup.prettyName}` || undefined,
			flash: 'Verification requires you to reset your password. Type the new one and confirm.',
			url: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/${authGroup._id}/setpass`,
			retryUrl: `${config.PROTOCOL}://${(aliasDns) ? aliasDns: config.SWAGGER}/api/${authGroup._id}/operations/user/reset-password`,
			bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
			bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH
		};
	},
	forgotScreen(authGroup, query, aliasDns = undefined, aliasUi = undefined) {
		return {
			authGroupName: (authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : authGroup.name,
			title: 'Forgot Password',
			tos: authGroup.primaryTOS,
			policy: authGroup.primaryPrivacyPolicy,
			iat: query.code,
			redirect: query.redirect || authGroup.primaryDomain || `https://${(aliasUi) ? aliasUi : config.UI_URL}/${authGroup.prettyName}` || undefined,
			flash: 'Type in your new password to reset',
			url: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/${authGroup._id}/setpass`,
			retryUrl: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/api/${authGroup._id}/operations/reset-user-password`,
			bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
			bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH
		};
	},
	async confirmAuthorization(provider, intDetails, authGroup) {
		const { prompt: { name, details }, params, session: { accountId } } = intDetails;
		assert.equal(name, 'consent');
		let { grantId } = intDetails;
		let grant;

		if (grantId) {
			grant = await provider.Grant.find(grantId);
		} else {
			grant = new (provider.Grant)({
				accountId,
				clientId: params.client_id,
				authGroup: authGroup.id
			});
		}

		if (details && details.missingOIDCScope) {
			grant.addOIDCScope(details.missingOIDCScope.join(' '));
		}
		if (details && details.missingOIDCClaims) {
			grant.addOIDCClaims(details.missingOIDCClaims);
		}
		if (details && details.missingResourceScopes) {
			// eslint-disable-next-line no-restricted-syntax
			for (const [indicator, scopes] of Object.entries(details.missingResourceScopes)) {
				grant.addResourceScope(indicator, scopes.join(' '));
			}
		}

		return { consent: { grantId: await grant.save() } };
	},
	async oidcRenderErrorOptions(authGroup, out) {
		return {
			title: 'oops! something went wrong',
			message: 'You may have navigated here by mistake',
			bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
			bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH,
			details: Object.entries(out).map(([key, value]) => `<p><strong>${key}</strong>: ${value}</p>`).join('')
		};
	},
	async oidcLogoutSourceOptions(authGroup, name, action, secret, skipPrompt = false) {
		return {
			title: 'Log Out',
			bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
			bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH,
			message: `Are you sure you want to sign-out from ${name}?`,
			formId: 'op.logoutForm',
			actionUrl: action,
			secret,
			inName:'xsrf',
			skipPrompt,
			'bdf635x': skipPrompt, // duplicate entry to be less obvious in js
			'a42ce03': 'op.logoutForm' // duplicate entry to be less obvious in js
		};
	},
	async oidcPostLogoutSourceOptions(authGroup, message, clientUri, initiateLoginUri, logoUri, policyUri, tosUri, clientName) {
		return {
			title: 'Success',
			clientName,
			message,
			clientUri,
			initiateLoginUri,
			logoUri,
			policyUri,
			tosUri,
			bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
			bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH,
			authGroup: {
				name: authGroup.name,
				primaryPrivacyPolicy: authGroup.primaryPrivacyPolicy,
				primaryTOS: authGroup.primaryTOS,
				primaryDomain: authGroup.primaryDomain
			}
		};
	},
	async savePKCESession(data) {
		return dal.savePKCESession(data);
	},
	async getPKCESession(ag, state) {
		return dal.getPKCESession(ag, state);
	}
};