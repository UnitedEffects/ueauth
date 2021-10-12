import Product from './model';
import { nanoid } from 'nanoid';

export default {
	async writeProduct(data) {
		data.codedId = nanoid(10);
		const product =  new Product(data);
		return product.save();
	},
	async getProducts(g, query) {
		query.query.authGroup = g;
		return Product.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getProduct(authGroup, id) {
		return Product.findOne( { authGroup, $or: [{ _id: id }, { codedId: id }] });
	},
	async deleteProduct(authGroup, id) {
		return Product.findOneAndRemove( { _id: id, authGroup });
	},
	async patchProduct(authGroup, id, data) {
		data.modifiedAt = Date.now();
		return Product.findOneAndUpdate({ _id: id, authGroup }, data, { new: true, overwrite: true, runValidators: true });
	},
	async getCoreProduct(query) {
		return Product.findOne(query);
	},
	async getCoreProducts(query) {
		return Product.find(query);
	},
	async updateCoreMetaData(authGroup, id, meta) {
		return Product.findOneAndUpdate({ _id: id, authGroup }, { meta } , { new: true });
	}
};