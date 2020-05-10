import IAT from '../models/initialAccessToken';
import auth from "../../../auth/auth";

export default {
    async updateAuthGroup(id, authGroup) {
        return IAT.findOneAndUpdate( { _id: id }, { 'payload.auth_group': authGroup }, {new: true});
    },

    async getOne(id, authGroupId) {
        return IAT.findOne({ _id: id }); //, 'payload.auth_group': authGroupId });
    },

    async deleteOne(id, authGroupId) {
        return IAT.findOneAndRemove( { _id: id }); //, 'payload.auth_group': authGroupId });
    }
}