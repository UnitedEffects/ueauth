import stateCheck from './model';

export default {
	async saveState(data) {
		const state = new stateCheck(data);
		return state.save();
	},
	async addAccountToState(authGroup, state, account) {
		return 	stateCheck.findOneAndUpdate({ authGroup, state, account: { $exists: false } }, { account }, { new: true });
	},
	async findState(authGroup, account, state) {
		return stateCheck.findOne({ authGroup, account, state });
	},
	async findStateNoAcc(authGroup, state) {
		return stateCheck.findOne({ authGroup, state });
	}
};