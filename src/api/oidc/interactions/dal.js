import PKCE from '../models/pkceSessions';

export default {
	async savePKCESession(data) {
		const pkce = new PKCE(data);
		return pkce.save();
	},
    async getPKCESession(ag, state) {
	    return PKCE.findOne({ 'payload.auth_group': ag, 'payload.state': state }).select({ payload: 1 });
    }
};