import Domain from './model';

export default {
	async writeDomain(data) {
		const org =  new Domain(data);
		return org.save();
	},
	async getDomains(g, o, query) {
		query.query.authGroup = g;
		query.query.organization = o;
		return Domain.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getDomain(authGroup, organization, id) {
		return Domain.findOne( { _id: id, authGroup, organization });
	},
	async deleteDomain(authGroup, organization, id) {
		return Domain.findOneAndRemove( { _id: id, authGroup, organization });
	},
	async patchDomain(authGroup, organization, id, data) {
		data.modifiedAt = Date.now();
		return Domain.findOneAndUpdate({ _id: id, authGroup, organization }, data, { new: true, overwrite: true });
	}
};