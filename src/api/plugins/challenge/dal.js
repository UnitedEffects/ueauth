import Challenge from './models/status';
import stateCheck from './models/stateCheck';

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
	async saveChallenge(data) {
		const challenge = new Challenge(data);
		return challenge.save();
	},
	async findChallengeAndUpdate(data) {
		const state = data.state;
		const query = JSON.parse(JSON.stringify(data));
		delete query.state;
		return Challenge.findOneAndUpdate(query, { state }, {new: true});
	},
	async status(query) {
		return Challenge.findOne(query);
	},
	async clearStatus(query) {
		return Challenge.findOneAndRemove(query);
	}
};