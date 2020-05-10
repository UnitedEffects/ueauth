import IAT from '../models/initialAccessToken';

export default {
    async updateAuthGroup(id, authGroup) {
        return IAT.findOneAndUpdate( { _id: id }, { 'payload.auth_group': authGroup }, {new: true});
    },

    async getOne(id, authGroupId) {
        return IAT.findOne({ _id: id, 'payload.auth_group': authGroupId });
    }
}