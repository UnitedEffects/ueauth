import Session from '../models/session';

export default {
	async removeSessionByAccountId(account) {
		return Session.deleteMany({ 'payload.accountId': account, 'payload.kind': 'Session' });
	}
};