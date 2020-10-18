import IAT from '../models/initialAccessToken';

export default {
    async updateAuthGroup(id, authGroupId) {
        return IAT.findOneAndUpdate( { _id: id }, { 'payload.auth_group': authGroupId }, {new: true});
    },

    async getOne(id, authGroupId) {
        return IAT.findOne({ _id: id, 'payload.auth_group': authGroupId });
    },

    async deleteOne(id, authGroupId) {
        return IAT.findOneAndRemove( { _id: id , 'payload.auth_group': authGroupId });
    }
}