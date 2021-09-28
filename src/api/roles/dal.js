import Role from './model';

export default {
	async writeRole(data) {
		const role =  new Role(data);
		return role.save();
	},
	async getAllRoles(g, query) {
		query.query.authGroup = g;
		return Role.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getOrganizationRoles(g, p, o, query) {
		query.query.authGroup = g;
		query.query.product = p;
		query.query.$or = [
			{ organization: o },
			{ organization: { $exists: false } }
		];
		return Role.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getRoles(g, p, query) {
		query.query.authGroup = g;
		query.query.product = p;
		query.query.custom = false;
		query.query.organization = { $exists: false };
		return Role.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getRole(authGroup, product, id) {
		return Role.findOne( { _id: id, authGroup, product });
	},
	async deleteRole(authGroup, product, id) {
		return Role.findOneAndRemove( { _id: id, authGroup, product });
	},
	async patchRole(authGroup, id, product, data) {
		data.modifiedAt = Date.now();
		const options = { new: true, overwrite: true };
		return Role.findOneAndUpdate({ _id: id, authGroup, product }, data, options);
	}
};