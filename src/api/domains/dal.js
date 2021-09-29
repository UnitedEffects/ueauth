import Domain from './model';

export default {
	async writeDomain(data) {
		const dom =  new Domain(data);
		return dom.save();
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
		const options = { new: true, overwrite: true };
		if(data.associatedOrgProducts.length > 0) {
			options.runValidators = true;
		}
		return Domain.findOneAndUpdate({ _id: id, authGroup, organization }, data, options);
	},
	async checkProducts(authGroup, organization, productId) {
		return Domain.find({ authGroup, organization, associatedOrgProducts: productId }).select({ _id: 1, name: 1, description: 1, active: 1, externalId: 1 });
	}
};