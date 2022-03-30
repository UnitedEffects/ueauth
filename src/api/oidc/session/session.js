import dal from './dal';

export default {
	async removeSessionByAccountId(accountId) {
		return dal.removeSessionByAccountId(accountId);
	},
	async addOrgContext(authGroup, uid, session, clientId, accountId, state, orgContext) {
		return dal.addOrgContext(authGroup, uid, session, clientId, accountId, state, orgContext);
	}
};