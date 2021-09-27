import Organization from './model';

export default {
	async writeOrg(data) {
		const org =  new Organization(data);
		return org.save();
	},
	async getOrgs(g, query) {
		query.query.authGroup = g;
		return Organization.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getOrg(authGroup, id) {
		return Organization.findOne( { _id: id, authGroup });
	},
	async deleteOrg(authGroup, id) {
		return Organization.findOneAndRemove( { _id: id, authGroup });
	},
	async patchOrg(authGroup, id, data) {
		data.modifiedAt = Date.now();
		return Organization.findOneAndUpdate({ _id: id, authGroup }, data, { new: true, overwrite: true });
	}
};