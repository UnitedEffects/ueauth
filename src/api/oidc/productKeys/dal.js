import Keys from '../models/productKey';
import CC from '../models/clientCredentials';

export default {
	async createKey(data) {
		const key = new Keys(data);
		return key.save();
	},
	async removeClientCredential(_id, clientId) {
		return CC.findOneAndRemove({ _id, 'payload.clientId': clientId, 'payload.kind': 'ClientCredentials'});
	},
	async getKeys(query) {
		return Keys.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getKey(authGroup, productId, _id, organizationId = undefined) {
		const filter = { _id, productId, authGroup };
		if(organizationId) filter.organizationId = organizationId;
		return Keys.findOne(filter);
	},
	async removeKey(authGroup, productId, _id, organizationId = undefined) {
		const filter = { _id, productId, authGroup };
		if(organizationId) filter.organizationId = organizationId;
		return Keys.findOneAndRemove(filter);
	},
};