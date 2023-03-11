import Boom from '@hapi/boom';
import crypto from 'crypto';
import {say} from '../../../say';
import group from '../../authGroup/group';
import config from '../../../config';
import web from './webauthn';
import acc from '../../accounts/account';
import states from '../state/state';
import iat from '../../oidc/initialAccess/iat';
import n from '../notifications/notifications';

const RESOURCE = 'PASSKEY';

export default {
	async reqWebAuthN(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.forbidden();
			const { authGroup } = await group.safeAuthGroup(req.authGroup);
			if(!req.body.email) throw Boom.badRequest('Email required');
			const user = JSON.parse(JSON.stringify(await acc.getAccountByEmailOrUsername(authGroup.id, req.body.email)));
			const domain = `${(req.customDomain) ? req.customDomain : (config.SWAGGER.includes('localhost')) ? 'localhost' : config.SWAGGER }`;
			const data = {
				accountId: user.id,
				domain
			};
			const result = await web.reqWebAuthN(authGroup, req.globalSettings, data);
			if(result) return res.respond(say.ok(result, RESOURCE));
			throw Boom.badRequest('no response');
		} catch(error) {
			if (error.isAxiosError) {
				console.error(error.response.status, error.response.data);
				return next(Boom.failedDependency(error.response.data || 'WebAuthN provider error'));
			}
			next(error);
		}
	},
	async bindWebAuthN(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.forbidden();
			const { authGroup } = await group.safeAuthGroup(req.authGroup);
			if(!req.user.email) throw Boom.forbidden();
			//this is really just here for debug and local dev....
			const domain = `${(req.customDomain) ? req.customDomain : (config.SWAGGER.includes('localhost')) ? 'localhost' : config.SWAGGER }`;
			const data = {
				accountId: req.user.id || req.user.sub,
				email: req.user.email,
				domain
			};
			const result = await web.bindWebAuthN(authGroup, req.globalSettings, data);
			if(result) return res.respond(say.ok(result, RESOURCE));
			throw Boom.badRequest('no response');
		} catch (error) {
			if (error.isAxiosError) {
				console.error(error.response.status, error.response.data);
				return next(Boom.failedDependency(error.response.data || 'WebAuthN provider error'));
			}
			next(error);
		}
	},
	async finishWebAuthN(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.forbidden();
			const { authGroup } = await group.safeAuthGroup(req.authGroup);
			if(!req.user.email) throw Boom.forbidden();
			if(!req.body.credential) throw Boom.badRequest('Need credentials');
			const data = {
				accountId: req.user.id || req.user.sub,
				credential: req.body.credential
			};
			const result = await web.finishWebAuthN(authGroup, req.globalSettings, data);
			if(result) return res.respond(say.ok(result, RESOURCE));
			throw Boom.badRequest('no response');
		} catch (error) {
			if (error.isAxiosError) {
				console.error(error);
				console.error(error.response.status, error.response.data);
				return next(Boom.failedDependency(error.response.data || 'WebAuthN provider error'));
			}
			next(error);
		}
	},
	async confirmWebAuthN(req, res, next) {
		try {
			const { safeAG, authGroup } = await group.safeAuthGroup(req.authGroup);
			if(authGroup?.pluginOptions?.webAuthN?.enable === true &&
				req.globalSettings?.webAuthN?.enabled === true) {
				if(!req.query.state) throw Boom.forbidden();
				const state = req.query.state;
				const exp = new Date(req.authInfo.exp * 1000);
				return res.render('webauthn/secureSet', {
					authGroup: safeAG,
					authGroupLogo: authGroup.config.ui.skin.logo,
					domain: `${config.PROTOCOL}://${config.SWAGGER}`,
					state,
					token: req.authInfo.jti,
					email: req.user.email,
					user: req.user.id,
					expiresDate: exp.toDateString(),
					expiresTime:exp.toTimeString(),
					title: 'Passkey Login Setup Wizard',
					message: 'You will need to do this for each login device'
				});
			}
			throw Boom.failedDependency(`Passkey setup is not available on the ${authGroup.name} Platform`);
		} catch (error) {
			console.error(error);
			next(Boom.failedDependency('It\'s us, not you. Please try again later'));
		}
	},
	async emailVerify(req, res, next) {
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
					authGroup: safeAG,
					passkey: true
				});
			}
		} catch (error) {
			next(error);
		}
	},
	async setWebAuthN(req, res, next) {
		try {
			const { safeAG, authGroup } = await group.safeAuthGroup(req.authGroup);
			if(authGroup?.pluginOptions?.webAuthN?.enable === true &&
                req.globalSettings?.webAuthN?.enabled === true) {
				const state = crypto.randomBytes(32).toString('hex');
				const stateData = {
					authGroup: req.authGroup.id,
					stateValue: state
				};
				await states.saveState(stateData);
				return res.render('webauthn/recover', {
					authGroup: safeAG,
					authGroupLogo: authGroup.config.ui.skin.logo,
					domain: `${config.PROTOCOL}://${config.SWAGGER}`,
					state,
					title: 'Passkey Login Setup Wizard',
					message: 'You will need to do this for each login device.'
				});
			}
			throw Boom.failedDependency(`Passkey setup is not available on the ${authGroup.name} Platform`);
		} catch (error) {
			console.error(error);
			next(Boom.failedDependency('It\'s us, not you. Please try again later'));
		}
	}
};

function emailVerifyNotification (authGroup, user, iAccessToken, state, customDomain) {
	return {
		iss: `${config.PROTOCOL}://${(customDomain) ? customDomain : config.SWAGGER}/${authGroup.id}`,
		createdBy: `proxy-${user.id}`,
		type: 'passwordless',
		formats: ['email'],
		recipientUserId: user.id,
		recipientEmail: user.email,
		recipientSms: user.txt,
		screenUrl: `${config.PROTOCOL}://${(customDomain) ? customDomain : config.SWAGGER}/${authGroup.id}/passkey?token=${iAccessToken.jti}&state=${state}`,
		subject: `${authGroup.prettyName} - Passkey Verify Identity`,
		message: 'You have requested an email identity verification. Click the link to continue. This link will expire in 15 minutes.',
	};
}