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
			if(!req.body.transactionId) throw Boom.badRequest('No transactionId');
			if(!req.body.privakeyId) throw Boom.badRequest('No privakeyId');
			if(!Object.keys(req.body).includes('buttonSelected')) throw Boom.badRequest('No action indicated');
			const state = (req.body.buttonSelected === 0) ? 'approved' : 'denied';
			let data;
			try {
				data = JSON.parse(req.body.transactionId);
			} catch (error) {
				throw Boom.badRequest('TransactionId format not JSON');
			}
			if(!data.uid) throw Boom.badRequest('No interaction id found');
			if(!data.accountId) throw Boom.badRequest('No account id found');
			const uid = data.uid;
			const accountId = data.accountId;
			console.info('ABOUT TO CALLBACK');
			const update = {
				uid,
				accountId,
				providerKey: req.body.guid,
				authGroup: req.authGroup.id,
				state
			};
			console.info(update);
			await challenge.callback(update);
			return res.respond(say.noContent());
		} catch (error) {
			next(error);
		}
	}
};