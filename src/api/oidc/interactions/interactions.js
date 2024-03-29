import Boom from '@hapi/boom';
import dal from './dal';
import acct from '../../accounts/account';
import iat from '../initialAccess/iat';
import n from '../../plugins/notifications/notifications';
import plugins from '../../plugins/plugins';
import fed from './federation';
import fedCache from '../models/cacheFederatedTokens';

const config = require('../../../config');
const { strict: assert } = require('assert');

const api = {
	passwordLessOptions(authGroup, user, iAccessToken, formats = [], uid, aliasDns = undefined) {
		const data = {
			iss: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/${authGroup.id}`,
			createdBy: `proxy-${user.id}`,
			type: 'passwordless',
			formats,
			recipientUserId: user.id,
			recipientEmail: user.email,
			recipientSms: user.txt,
			favicon: authGroup.config?.ui?.skin?.favicon,
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
	standardLogin(authGroup, client, debug, prompt, session, uid, params, flash = undefined, mfa = undefined) {
		const loginOptions = fed.getFederationCodesFromAG(authGroup);
		const loginButtons = loginOptions.filter((option) => {
			return (client?.client_federation_options?.join(' | ').toLowerCase().includes(option.code));
		});
		const altLogin = (params.passwordless === true || params.webAuthN === true || params.deviceLogin === true || loginButtons.length !== 0);
		return {
			client,
			altLogin,
			loginButtons,
			bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
			bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH,
			favicon: authGroup.config?.ui?.skin?.favicon,
			authGroup: authGroup._id || authGroup.id,
			domain: `${config.PROTOCOL}://${config.SWAGGER}`,
			authGroupName: (authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : authGroup.name,
			authGroupLogo: authGroup.config?.ui?.skin?.logo || undefined,
			splashImage: authGroup.config?.ui?.skin?.splashImage || undefined,
			align: authGroup.config.ui.skin.loginOrientation || undefined,
			locked: authGroup.locked,
			registerUrl: client.registerUrl || authGroup.registerUrl || undefined,
			uid,
			tosUri: client.tosUri || authGroup.primaryTOS || undefined,
			policyUri: client.policyUri ||  authGroup.primaryPrivacyPolicy || undefined,
			details: prompt.details,
			params,
			title: 'Sign-in',
			session: session ? debug(session) : undefined,
			flash,
			mfa,
			dbg: {
				params: debug(params),
				prompt: debug(prompt)
			}
		};
	},
	samlLogin(sp, idp, options) {
		return new Promise( (resolve, reject) => {
			return sp.create_login_request_url(idp, options, (err, login_url, request_id) => {
				if(err) return reject(err);
				return resolve({ loginUrl: login_url, reqId: request_id });
			});
		});
	},
	samlAssert(sp, idp, options) {
		return new Promise((resolve, reject) => {
			return sp.post_assert(idp, options, (err, saml_response) => {
				if(err) return reject(err);
				return resolve(saml_response);
			});
		});
	},
	pwdlessLogin(authGroup, client, debug, prompt, session, uid, params, flash = undefined) {
		return {
			client,
			bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
			bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH,
			favicon: authGroup.config?.ui?.skin?.favicon,
			authGroup: authGroup._id,
			authGroupName: (authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : authGroup.name,
			authGroupLogo: authGroup.config.ui.skin.logo || undefined,
			splashImage: authGroup.config.ui.skin.splashImage || undefined,
			align: authGroup.config.ui.skin.loginOrientation || undefined,
			uid,
			locked: authGroup.locked,
			registerUrl: client.registerUrl || authGroup.registerUrl || undefined,
			details: prompt.details,
			tosUri: client.tosUri || authGroup.primaryTOS || undefined,
			policyUri: client.policyUri ||  authGroup.primaryPrivacyPolicy || undefined,
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
			favicon: authGroup.config?.ui?.skin?.favicon,
			uid,
			authGroup: authGroup._id,
			authGroupName: (authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : authGroup.name,
			authGroupLogo: authGroup.config?.ui?.skin?.logo || undefined,
			splashImage: authGroup.config?.ui?.skin?.splashImage || undefined,
			align: authGroup.config.ui.skin.loginOrientation || undefined,
			details: prompt.details,
			tosUri: client.tosUri || authGroup.primaryTOS || undefined,
			policyUri: client.policyUri ||  authGroup.primaryPrivacyPolicy || undefined,
			params,
			title: 'Authorize',
			session: session ? debug(session) : undefined,
			dbg: (config.ENV !== 'production' || authGroup.name === 'root') ? {
				params: debug(params),
				prompt: debug(prompt)
			} : undefined
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
		// if a federated token was found and saved, cache it to send to token claims later
		if(params.federated_token) {
			try {
				if(intDetails?.session?.uid) {
					const ft = new fedCache({
						expiresAt: new Date(Date.now() + authGroup.config.ttl.session*1000),
						payload: {
							authGroup: authGroup.id,
							accountId: accountId,
							clientId: params.client_id,
							sessionUid: intDetails.session.uid,
							federatedToken: params.federated_token
						}
					});
					await ft.save();
				}
			} catch (error) {
				console.error('Unable to cache original federated token', error);
			}
		}
		return { consent: { grantId: await grant.save() } };
	},
	async oidcRenderErrorOptions(authGroup, out, safeAG) {
		return {
			title: 'oops! something went wrong',
			message: 'Click more information for details.',
			redirect: `https://${(authGroup.aliasDnsUi) ? authGroup.aliasDnsUi : config.UI_URL}/${authGroup.prettyName}` ||
				authGroup.primaryDomain ||
				undefined,
			bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
			bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH,
			favicon: authGroup.config?.ui?.skin?.favicon,
			authGroup: safeAG,
			authGroupLogo: authGroup.config?.ui?.skin?.logo || undefined,
			splashImage: authGroup.config?.ui?.skin?.splashImage || undefined,
			details: Object.entries(out).map(([key, value]) => `<p><strong>${key}</strong>: ${value}</p>`).join('')
		};
	},
	async oidcLogoutSourceOptions(authGroup, name, action, secret, client, skipPrompt = false) {
		let clientUri = (client?.clientUri) ? client.clientUri : ( authGroup?.config?.defaultLogoutRedirect || null);
		return {
			title: 'Log Out',
			bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
			bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH,
			favicon: authGroup.config?.ui?.skin?.favicon,
			authGroupLogo: authGroup.config?.ui?.skin?.logo || undefined,
			splashImage: authGroup.config?.ui?.skin?.splashImage || undefined,
			clientName: (name !== authGroup.name) ? name : undefined,
			clientUri: (!clientUri && authGroup.associatedClient === client?.clientId) ?
				`https://${(authGroup.aliasDnsUi) ? authGroup.aliasDnsUi : config.UI_URL}/${authGroup.prettyName}` : clientUri,
			initiateLoginUri: client?.initiateLoginUri,
			logoUri: client?.logoUri,
			tosUri: client?.tosUri || authGroup.primaryTOS || undefined,
			policyUri: client?.policyUri ||  authGroup.primaryPrivacyPolicy || undefined,
			authGroup: {
				name: authGroup.name,
				primaryPrivacyPolicy: authGroup.primaryPrivacyPolicy,
				primaryTOS: authGroup.primaryTOS,
				primaryDomain: authGroup.primaryDomain
			},
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
			title: 'Confirmed',
			clientName,
			message,
			clientUri,
			initiateLoginUri,
			logoUri,
			tosUri: tosUri || authGroup.primaryTOS || undefined,
			policyUri: policyUri ||  authGroup.primaryPrivacyPolicy || undefined,
			bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
			bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH,
			favicon: authGroup.config?.ui?.skin?.favicon,
			authGroupLogo: authGroup.config?.ui?.skin?.logo || undefined,
			splashImage: authGroup.config?.ui?.skin?.splashImage || undefined,
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
	},
	async sendMagicLink(authGroup, uid, customDomain, account, global) {
		let iAccessToken;
		try {
			let user;
			if(typeof account === 'string') {
				user = await acct.getAccount(authGroup.id, account);
			} else {
				user = JSON.parse(JSON.stringify(account));
			}
			if(!user.id) throw Boom.notFound(account);
			let settings;
			if(!global) {
				settings = await plugins.getLatestPluginOptions();
			} else settings = JSON.parse(JSON.stringify(global));
			const meta = {
				auth_group: authGroup.id,
				sub: user.id,
				email: user.email,
				uid
			};
			iAccessToken = await iat.generateIAT(900, ['auth_group'], authGroup, meta);
			const notificationData = api.passwordLessOptions(authGroup, user, iAccessToken, [], uid, customDomain);
			await n.notify(settings, notificationData, authGroup);
		} catch (error) {
			if(iAccessToken) {
				await iat.deleteOne(iAccessToken.jti, authGroup.id);
			}
			throw error;
		}
	},
};

export default api;