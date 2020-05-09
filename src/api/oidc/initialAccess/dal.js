import IAT from '../models/initialAccessToken';

export default {
    async updateAuthGroup(id, authGroup) {
        return IAT.findOneAndUpdate( { _id: id }, { 'payload.auth_group': authGroup }, {new: true});
    }
}