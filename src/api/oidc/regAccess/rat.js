import oidc from '../oidc';
import dal from './dal';

export default {
	async regAccessToken(id, authGroup) {
		if(!authGroup) throw new Error('authGroupId not defined');
		const check = await dal.findByClientId(id);
		const result = await new (oidc(authGroup).RegistrationAccessToken)({ clientId: id, policies: ['auth_group'] }).save();
		if(check) {
			await dal.deleteOne(check._id);
		}
		return result;
	}
};
