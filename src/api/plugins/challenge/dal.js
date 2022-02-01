import Challenge from './model';

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
	}
};