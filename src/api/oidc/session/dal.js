import Session from '../models/session';
import OrgSession from '../models/orgContextSession';

export default {
	async removeSessionByAccountId(account) {
		return Session.deleteMany({ 'payload.accountId': account, 'payload.kind': 'Session' });
	},
	async addOrgContext(authGroup, uid, session, clientId, accountId, state, orgContext) {
		// todo this should be an overwrite...
		const os = new OrgSession({
			authGroup,
			uid,
			session,
			clientId,
			accountId,
			state,
			orgContext
		});
		return os.save();
	}
};