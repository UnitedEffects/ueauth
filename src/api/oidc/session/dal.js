import Session from '../models/session';

export default {
	async removeSessionByAccountId(account) {
		return Session.deleteMany({ 'payload.account': account, 'payload.kind': 'Session' });
	}
};