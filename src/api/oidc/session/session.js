import dal from './dal';

export default {
	async removeSessionByAccountId(accountId) {
		return dal.removeSessionByAccountId(accountId);
	}
};