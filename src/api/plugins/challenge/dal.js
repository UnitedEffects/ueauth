import Challenge from './models/status';

export default {
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