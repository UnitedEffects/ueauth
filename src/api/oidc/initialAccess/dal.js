import IAT from '../models/initialAccessToken';

export default {
	async updateAuthGroup(id, meta) {
		const update = {
			'payload.auth_group': meta.auth_group
		};
		if(meta.sub) update['payload.sub'] = meta.sub;
		if(meta.email) update['payload.email'] = meta.email;
		if(meta.uid) update['payload.uid'] = meta.uid;
		if(meta.state) update['payload.state'] = meta.state;

		return IAT.findOneAndUpdate( { _id: id }, update, {new: true});
	},

	async getOne(id, authGroupId) {
		return IAT.findOne({ _id: id, 'payload.auth_group': authGroupId });
	},

	async deleteOne(id, authGroupId) {
		return IAT.findOneAndRemove( { _id: id , 'payload.auth_group': authGroupId });
	},

	async insertMany(docs) {
		return IAT.insertMany(docs, { ordered: false });
	}
};