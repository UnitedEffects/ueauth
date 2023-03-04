import challenge from './challenge';
import Boom from '@hapi/boom';
import acc from '../../accounts/account';
import group from '../../authGroup/group';
import {say} from '../../../say';
import iat from '../../oidc/initialAccess/iat';
import crypto from 'crypto';
import acct from '../../accounts/account';

const config = require('../../../config');

export default {
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
				let state;
				if(!req.query.state) {
					state = crypto.randomBytes(32).toString('hex');
					const path = req.path;
					return res.redirect(`${path}?state=${state}`);
				}
				state = req.query.state;
				return res.render('challenge/recover', {
					authGroup: safeAG,
					authGroupLogo: authGroup.config.ui.skin.logo,
					state,
					title: 'Device Setup Wizard',
					message: 'You can use this wizard to connect or reconnect your account to your device so you can use MFA or login with your device. You might need to do this if you lost your device, deleted the device app, or revoked your service on the app. This process will revoke all existing keys on any devices you currently have.',
					request: `${config.PROTOCOL}://${(authGroup.aliasDnsOIDC) ? authGroup.aliasDnsOIDC : config.SWAGGER}/api/${authGroup.id}/mfa/instructions`
				});
			}
			throw Boom.forbidden(`Device recovery is not available on the ${authGroup.name} Platform`);
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
				result = await challenge.emailVerify(authGroup, req.globalSettings, user, state);
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
				await acct.sendAccountLockNotification(authGroup, account, req.globalSettings);
				const meta = {
					sub: req.user.id || req.user.sub,
					email: req.user.email,
					uid: state
				};
				const token = await iat.generateIAT(360, ['auth_group'], authGroup, meta);
				const uri = `${config.PROTOCOL}://${(authGroup.aliasDnsOIDC) ? authGroup.aliasDnsOIDC : config.SWAGGER}/api/${authGroup.id}/mfa/safe-recovery`;
				const output = {
					token: token.jti,
					uri,
					requestInstructions: 'Send header authorization: bearer token along with body json including state and selection = "email" or "device" to the uri'
				};
				return res.respond(say.accepted(output, 'MFA RECOVERY'));
			}
			throw Boom.forbidden(`MFA recovery is not available on the ${authGroup.name} Platform`);
		} catch (error) {
			next(error);
		}
	}
};

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
	const update = await acc.enableMFA(authGroup.id, account.id);
	if(!update || !bindData) {
		throw Boom.failedDependency('Unable to set MFA for this account. Please try again later.');
	}
	const instructions = await challenge.bindInstructions(authGroup, req.globalSettings, bindData);
	return { ...instructions, warnings };
}