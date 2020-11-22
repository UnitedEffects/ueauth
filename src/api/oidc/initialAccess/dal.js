import IAT from '../models/initialAccessToken';

export default {
    async updateAuthGroup(id, meta) {
        const update = {
            'payload.auth_group': meta.auth_group
        };
        if(meta.user_id) update['payload.user_id'] = meta.user_id;
        if(meta.user_email) update['payload.user_email'] = meta.user_email;

        return IAT.findOneAndUpdate( { _id: id }, update, {new: true});
    },

    async getOne(id, authGroupId) {
        return IAT.findOne({ _id: id, 'payload.auth_group': authGroupId });
    },

    async deleteOne(id, authGroupId) {
        return IAT.findOneAndRemove( { _id: id , 'payload.auth_group': authGroupId });
    }
}