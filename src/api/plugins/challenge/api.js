import Boom from '@hapi/boom';
import { v4 as uuid } from 'uuid';
import challenge from './challenge';
import states from '../state/state';
import acc from '../../accounts/account';
import group from '../../authGroup/group';
import {say} from '../../../say';
import iat from '../../oidc/initialAccess/iat';
import crypto from 'crypto';
import acct from '../../accounts/account';
import n from '../notifications/notifications';

const config = require('../../../config');

export default {
	async customChallenge(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.forbidden();
			const { authGroup } = await group.safeAuthGroup(req.authGroup);
			if(!req.body.lookup) throw Boom.badRequest();
			const account = await acct.getAccountByEmailOrId(authGroup.id, req.body.lookup);
			if(!account) throw Boom.badRequest(`Could not identify account ${req.body.lookup}`);
			if (account.mfa?.enabled !== true) throw Boom.badRequest(`Account ${req.body.lookup} does not have an auth device enabled.`);
			const stateValue = req.body.state || crypto.randomBytes(64).toString('hex');
			await states.saveState({
				stateValue,
				authGroup: authGroup.id,
				account: account.id
			});
			const meta = {
				event: 'ue.challenge.callback',
				callback: req.body.callback,
				duration: req.body.duration,
				content: {
					title: req.body.title,
					header: req.body.header,
					body: req.body.message
				}
			};
			const deviceResult = await challenge.sendChallenge(authGroup, req.globalSettings, {
				accountId: account.id,
				mfaEnabled: true
			}, stateValue, meta);
			if(!deviceResult?.id) throw Boom.failedDependency('unknown challenge error');
			const out = {
				key: deviceResult.id,
				accountId: account.id,
				state: stateValue,
				callback: req.body.callback,
				duration: req.body.duration
			};
			return res.respond(say.ok(out, 'CHALLENGE'));
		} catch (error) {
			next(error);
		}
	},
	async sendChallenge(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.forbidden();
			const { authGroup } = await group.safeAuthGroup(req.authGroup);
			if(!req.body.lookup) throw Boom.badRequest();
			if(!req.body.state) throw Boom.forbidden();
			const account = await acct.getAccountByEmailUsernameOrPhone(authGroup.id, req.body.lookup);
			if(!account) throw Boom.badRequest();
			const validate = await states.findState(authGroup.id, account.id, req.body.state);
			if(!validate) throw Boom.forbidden();
			const meta = {
				content: {
					title: 'Authorization Request',
					header: `${authGroup.name} Platform`,
					body: 'If you initiated this login, Approve below. Otherwise click Decline and change your password.'
				}
			};
			const deviceResult = await challenge.sendChallenge(authGroup, req.globalSettings, {
				accountId: account.id,
				mfaEnabled: true
			}, req.body.state, meta);
			if(!deviceResult) throw Boom.failedDependency('unknown challenge error');
			const out = JSON.parse(JSON.stringify(deviceResult));
			out.accountId = account.id;
			return res.respond(say.ok(out, 'CHALLENGE'));
		} catch (error) {
			next(error);
		}
	},
	async status (req, res, next) {
		try {
			const accountId = req.params.account;
			const uid = req.params.uid;
			const authGroup = req.authGroup.id;
			const providerKey = req.params.key;
			const result = await challenge.status({ accountId, uid, authGroup, providerKey });
			if(result?.state === 'approved') return res.respond(say.noContent());
			return res.respond(say.partial());
		} catch (error) {
			next();
		}
	},
	async callback(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.badRequest('Auth Group missing');
			const { authGroup } = await group.safeAuthGroup(req.authGroup);
			await challenge.callback(authGroup, req.globalSettings, req.body);
			return res.respond(say.noContent());
		} catch (error) {
			next(error);
		}
	},
	async recover(req, res, next) {
		try {
			const { safeAG, authGroup } = await group.safeAuthGroup(req.authGroup);
			if(authGroup?.config?.mfaChallenge?.enable === true &&
				req.globalSettings?.mfaChallenge?.enabled === true) {
				let state = (req.query.state) ? req.query.state : crypto.randomBytes(32).toString('hex');
				if(!req.query.token) {
					const stateData = {
						authGroup: req.authGroup.id,
						stateValue: state
					};
					await states.saveState(stateData);
				}

				return res.render('challenge/recover', {
					authGroup: safeAG,
					authGroupLogo: authGroup.config.ui.skin.logo,
					favicon: authGroup.config.ui?.skin?.favicon,
					state,
					token: req.query.token,
					accountId: req.query.accountId,
					email: req.query.email,
					title: 'Device Setup Wizard',
					message: 'You can use this wizard to connect or reconnect your account to your device so you can use MFA or login with your device. You might need to do this if you lost your device, deleted the device app, or revoked your service on the app. This process will revoke all existing keys on any devices you currently have.',
					request: `${config.PROTOCOL}://${(req.customDomain) ? req.customDomain : config.SWAGGER}/api/${authGroup.id}/mfa/instructions`,
					domain: `${config.PROTOCOL}://${(req.customDomain) ? req.customDomain : config.SWAGGER}`,
				});
			}
			throw Boom.forbidden(`Device recovery is not available on the ${authGroup.name} Platform`);
		} catch (error) {
			next(error);
		}
	},
	async verifyIdentByEmail(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.forbidden();
			const { authGroup, safeAG } = await group.safeAuthGroup(req.authGroup);
			let iAccessToken;
			try {
				if(!req.query.state) throw Boom.badRequest('State required');
				if(!req.query.lookup) throw Boom.badRequest('Email required');
				const lookup = req.query.lookup;
				const state = req.query.state;
				const validate = await states.findStateNoAcc(authGroup.id, state);
				if(!validate) throw Boom.forbidden();
				const account = await acc.getAccountByEmailUsernameOrPhone(authGroup.id, lookup);
				if(!account) throw Boom.forbidden();
				iAccessToken = await iat.generateSimpleIAT(900, ['auth_group'], authGroup, account, state);
				const notificationData = emailVerifyNotification(authGroup, account, iAccessToken, state, req.customDomain);
				await n.notify(req.globalSettings, notificationData, req.authGroup);
				return res.render('response/response', {
					title: 'SUCCESS!',
					message: 'Check your email to continue.',
					authGroupLogo: authGroup.config?.ui?.skin?.logo || undefined,
					splashImage: authGroup.config?.ui?.skin?.splashImage || undefined,
					favicon: authGroup.config.ui?.skin?.favicon,
					authGroup: safeAG
				});
			} catch (e) {
				console.error(e);
				if(iAccessToken) {
					await iat.deleteOne(iAccessToken.jti, authGroup.id);
				}
				return res.render('response/response', {
					title: 'Unable to verify you',
					message: 'Something went wrong. Wait a bit and then try again.',
					authGroupLogo: authGroup.config?.ui?.skin?.logo || undefined,
					splashImage: authGroup.config?.ui?.skin?.splashImage || undefined,
					favicon: authGroup.config.ui?.skin?.favicon,
					authGroup: safeAG,
					passkey: true
				});
			}
		} catch (error) {
			next(error);
		}
	},
	async safeRecoveryNotification(req, res, next) {
		try {
			const token = JSON.parse(JSON.stringify(req.user));
			const { authGroup } = await group.safeAuthGroup(req.authGroup);
			const user = token.sub;
			const uid = token.uid;
			const selection = req.body.selection;
			const state = req.body.state;
			if(uid !== state) throw Boom.unauthorized();
			let result;
			switch (selection.toLowerCase()) {
			case 'email':
				result = await challenge.emailVerify(authGroup, req.globalSettings, user, state, req.customDomain);
				if(!result) throw Boom.badRequest(`The ${authGroup.name} platform ran into an issue accessing the notification service. Please try again later and if the issue continues, contact the administrator.`);
				return res.respond(say.ok({ selection: 'email', sent: true }));
			case 'device':
				result = await challenge.sendChallenge(
					authGroup,
					req.globalSettings, { accountId: user, mfaEnabled: true }, uid, {
						content: {
							title: 'Identity Verification',
							header: `Your ${authGroup.name} Identity Needs Validation`,
							body: 'If you initiated this verification, Approve below. Otherwise click Decline and change your password.'
						}
					}
				);
				if(!result) throw Boom.badRequest(`The ${authGroup.name} platform ran into an issue accessing the MFA provider. Please try again later and if the issue continues, contact the administrator.`);
				return res.respond(say.ok({ selection: 'device', ...result }));
			default:
				throw Boom.badRequest('Unsupported');
			}
		} catch (error) {
			next(error);
		}
	},
	async getMFAInstruction(req, res, next) {
		try {
			const { authGroup } = await group.safeAuthGroup(req.authGroup);
			//basic auth...
			if(authGroup?.config?.mfaChallenge?.enable === true &&
				req.globalSettings?.mfaChallenge?.enabled === true) {
				// find account
				const account = await acc.getAccount(authGroup.id, req.user.sub || req.user.id);
				const mfaAcc = { mfaEnabled: account.mfa.enabled, accountId: account.id };
				if(!account.mfa?.enabled) {
					// if account is not mfaEnabled, enable and send instructions
					await acct.sendAccountLockNotification(authGroup, account, req.globalSettings);
					const result = await bindAndSendInstructions(req, mfaAcc, account);
					return res.respond(say.ok(result, 'MFA RECOVERY'));
				}

				const code = req.body.code;
				const state = req.body.state;
				const method = req.body.method;
				let proceedWithInstructions = false;

				if(method === 'email') {
					const iToken = JSON.parse(JSON.stringify(
						await iat.getOne(code, req.authGroup.id)
					));
					if(iToken?.payload?.uid === state &&
						iToken?.payload?.sub === account.id &&
						iToken?.payload?.email === account.email) {
						proceedWithInstructions = true;
					}
				}

				if(method === 'device') {
					// device flow....
					const providerKey = req.body.providerKey;
					const device = await challenge.status({
						accountId: account.id,
						uid: state,
						authGroup: authGroup.id,
						providerKey
					});
					if (device?.state === 'approved') {
						proceedWithInstructions = true;
					}
				}

				if(proceedWithInstructions) {
					// if account is mfaEnabled:
					// is there a onetime use token in the query parameter?
					// if so, send instructions to rebind
					const result = await bindAndSendInstructions(req, mfaAcc, account);
					return res.respond(say.ok(result, 'MFA RECOVERY'));
				}

				if(method) {
					// here because we went through the flow once and it was not approved
					throw Boom.unauthorized();
				}

				// if not, create a onetime use access token and
				// send with instructions to request email or device confirmation
				try {
					await acct.sendAccountLockNotification(authGroup, account, req.globalSettings);
				} catch (e) {
					console.error(e?.data || e?.message || e);
					if(config.ENV === 'production') throw Boom.failedDependency('Unable to send lock notification - there may be a security issue.')
				}

				const meta = {
					sub: req.user.id || req.user.sub,
					email: req.user.email,
					uid: state
				};
				const token = await iat.generateIAT(360, ['auth_group'], authGroup, meta);
				const uri = `${config.PROTOCOL}://${(req.customDomain) ? req.customDomain : config.SWAGGER}/api/${authGroup.id}/mfa/safe-recovery`;
				const output = {
					token: token.jti,
					uri,
					requestInstructions: 'Send header authorization: bearer token along with body json including state and selection = "email" or "device" to the uri'
				};
				if(req.body.passkey?.credential) {
					const newToken = await iat.generateSimpleIAT(900, ['auth_group'], authGroup, account, state);
					output.passkeyToken = newToken.jti;
				}
				return res.respond(say.accepted(output, 'DEVICE RECOVERY'));
			}
			throw Boom.forbidden(`Device recovery is not available on the ${authGroup.name} Platform`);
		} catch (error) {
			next(error);
		}
	}
};

function emailVerifyNotification(authGroup, user, iAccessToken, state, customDomain) {
	return {
		iss: `${config.PROTOCOL}://${(customDomain) ? customDomain : config.SWAGGER}/${authGroup.id}`,
		createdBy: `proxy-${user.id}`,
		type: 'passwordless',
		formats: ['email'],
		recipientUserId: user.id,
		recipientEmail: user.email,
		recipientSms: user.txt,
		screenUrl: `${config.PROTOCOL}://${(customDomain) ? customDomain : config.SWAGGER}/${authGroup.id}/recover-mfa?token=${iAccessToken.jti}&state=${state}&accountId=${user.id}&email=${user.email}`,
		subject: `${authGroup.prettyName} - Device Setup Verify Identity`,
		message: 'You have requested an email identity verification. Click the link to continue. This link will expire in 15 minutes.',
	};
}

async function bindAndSendInstructions(req, mfaAcc, account) {
	const { authGroup } = await group.safeAuthGroup(req.authGroup);
	let bindData;
	let warnings = [];
	try {
		warnings = await challenge.revokeAllDevices(authGroup, req.globalSettings, mfaAcc);
		bindData = await challenge.bindUser(authGroup, req.globalSettings, mfaAcc);
	} catch (e) {
		console.error(e);
		throw Boom.failedDependency('Unable to set MFA for this account. Please try again later.');
	}
	// todo - evaluate whether there is a better time to do this in the process.
	const update = await acc.enableMFA(authGroup.id, account.id);
	if(!update || !bindData) {
		throw Boom.failedDependency('Unable to set MFA for this account. Please try again later.');
	}
	const instructions = await challenge.bindInstructions(authGroup, req.globalSettings, bindData, account.email);
	return { ...instructions, warnings };
}