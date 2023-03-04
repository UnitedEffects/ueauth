import group from '../../authGroup/group';
import crypto from 'crypto';
import config from '../../../config';
import Boom from '@hapi/boom';

export default {
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
					state,
					title: 'Passkey Setup Wizard',
					message: 'You can use this wizard to setup a passkey for login. Passkeys are tied to the browser or device you are using for login and not centrally managed. You will need to go through this setup for each device from which you wish to login.'
				});
			}
			throw Boom.failedDependency(`Passkey setup is not available on the ${authGroup.name} Platform`);
		} catch (error) {
			next(error);
		}
	}
};