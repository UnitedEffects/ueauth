import RAT from '../models/registrationAccessToken';

export default {
	async getOne(id) {
		return RAT.findOne({ _id: id });
	},

	async findByClientId(id) {
		return RAT.findOne({ 'payload.clientId': id });
	},

	async deleteOne(id) {
		return RAT.findOneAndRemove( { _id: id });
	}
};