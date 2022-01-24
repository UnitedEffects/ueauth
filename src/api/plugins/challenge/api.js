import challenge from './challenge';
import Boom from '@hapi/boom';
import {say} from '../../../say';

export default {
	async status (req, res, next) {
		try {
			const accountId = req.params.account;
			const uid = req.params.uid;
			const authGroup = req.authGroup.id;
			const providerKey = req.params.key;
			const result = await challenge.status({ accountId, uid, authGroup, providerKey });
			if(result?.state === 'approved') return res.respond(say.noContent());
			throw Boom.notFound();
		} catch (error) {
			next();
		}
	},
	async callback(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.badRequest('Auth Group missing');
			await challenge.callback(req.authGroup, req.globalSettings, req.body);
			return res.respond(say.noContent());
		} catch (error) {
			next(error);
		}
	}
};