import oidc from '../oidc';
import dal from './dal';

export default {
	// todo - incomplete implementation for bulk user import
	async generateManyIAT(expiresIn, policies, authGroup, users) {
		if(!authGroup) throw new Error('authGroup not defined');
		const setOfIATs = [];
		await Promise.all((users.map(async(x) => {
			const iat = new (oidc(authGroup).InitialAccessToken)({ expiresIn, policies });
			iat.payload.auth_group = authGroup.id;
			iat.payload.sub = x._id || x.id;
			iat.payload.email = x.email;
			setOfIATs.push(iat);
			return x;
		})));
		return dal.insertMany(setOfIATs);
	},

	async generateIAT(expiresIn, policies, authGroup, meta = {}) {
		if(!authGroup) throw new Error('authGroup not defined');
		return new (oidc(authGroup).InitialAccessToken)({ expiresIn, policies }).save().then(async (x) => {
			const metaData = {
				auth_group: authGroup.id,
				sub: meta.sub,
				email: meta.email,
				uid: meta.uid
			};
			const iat = await dal.updateAuthGroup(x, metaData);
			const response = JSON.parse(JSON.stringify(iat.payload));
			delete response.auth_group;
			delete response.policies;
			return response;
		});
	},

	async generateSimpleIAT(expiresIn, policies, authGroup, user, state) {
		if(!authGroup) throw new Error('authGroup not defined');
		return new (oidc(authGroup).InitialAccessToken)({ expiresIn, policies }).save().then(async (x) => {
			const metaData = {
				auth_group: authGroup.id,
				sub: user.id,
				email: user.email,
				state
			};
			const iat = await dal.updateAuthGroup(x, metaData);
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
};