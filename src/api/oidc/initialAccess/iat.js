import oidc from '../oidc';
import dal from './dal';

export default {
    async generateIAT(expiresIn, policies, authGroup) {
        return new (oidc(authGroup).InitialAccessToken)({ expiresIn, policies }).save().then(async (x) => {
            const iat = await dal.updateAuthGroup(x, authGroup);
            const response = JSON.parse(JSON.stringify(iat.payload));
            delete response.auth_group;
            delete response.policies;
            return response;
        });
    },

    async getOne(id, authGroupId) {
        return dal.getOne(id, authGroupId);
    }
}