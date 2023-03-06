import Boom from '@hapi/boom';
import crypto from 'crypto';
import {say} from '../../../say';
import group from '../../authGroup/group';
import config from '../../../config';
import web from './webauthn';

const RESOURCE = 'PASSKEY';

export default {
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
			return res.respond(say.ok(result, RESOURCE));
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
			return res.respond(say.ok(result, RESOURCE));
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
			next(error);
		}
	},
	async setWebAuthN(req, res, next) {
		try {
			const { safeAG, authGroup } = await group.safeAuthGroup(req.authGroup);
			if(authGroup?.pluginOptions?.webAuthN?.enable === true &&
                req.globalSettings?.webAuthN?.enabled === true) {
				let state;
				if(!req.query.state) {
					state = crypto.randomBytes(32).toString('hex');
					const path = req.path;
					return res.redirect(`${path}?state=${state}`);
				}
				state = req.query.state;
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
			next(error);
		}
	}
};