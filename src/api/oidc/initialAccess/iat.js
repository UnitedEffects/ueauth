import oidc from '../oidc';
import dal from './dal';

export default {
    async generateIAT(expiresIn, policies, authGroup) {
        if(!authGroup) throw new Error('authGroupId not defined');
        return new (oidc(authGroup).InitialAccessToken)({ expiresIn, policies }).save().then(async (x) => {
            const iat = await dal.updateAuthGroup(x, authGroup.id);
            const response = JSON.parse(JSON.stringify(iat.payload));
            delete response.auth_group;
            delete response.policies;
            return response;
        });
    },

    async getOne(id, authGroupId) {
        return dal.getOne(id, authGroupId);
    },

    async deleteOne(id, authGroupId) {
        return dal.deleteOne(id, authGroupId);
    }
}