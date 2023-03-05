import Boom from '@hapi/boom';
import iat from './iat';
import { say } from '../../../say';
import crypto from 'crypto';

const RESOURCE = 'IAT';

export default {
	/**
     * Useful when you need to create an implicit style token out of band. Not to be used for system access.
     * @param req
     * @param res
     * @param next
     * @returns {Promise<void>}
     */
	async simpleIAT(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.forbidden();
			const state = (req.body.state) ? req.body.state : crypto.randomBytes(32).toString('hex');
			const user = req.user;
			if(!user.email) throw Boom.forbidden('request must be from a person');
			const token = await iat.generateSimpleIAT(600, ['auth_group'], req.authGroup, user, state);
			return res.respond(say.created(token, RESOURCE));
		} catch (error) {
			next(error);
		}
	}
};