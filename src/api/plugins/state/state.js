import dal from './dal';

export default {
	async saveState(data) {
		return dal.saveState(data);
	},
	async findState(authGroup, account, state) {
		return dal.findState(authGroup, account, state);
	},
	async findStateNoAcc(authGroup, state) {
		return dal.findStateNoAcc(authGroup, state);
	},
	async addAccountToState(authGroup, state, account) {
		return 	dal.addAccountToState(authGroup, state, account);
	},
};