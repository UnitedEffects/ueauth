import Product from './model';

export default {
	async writeDomain(data) {
		const product =  new Product(data);
		return product.save();
	},
	async getProducts(g, query) {
		query.query.authGroup = g;
		return Product.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getProduct(authGroup, id) {
		return Product.findOne( { _id: id, authGroup });
	},
	async deleteProduct(authGroup, id) {
		return Product.findOneAndRemove( { _id: id, authGroup });
	},
	async patchProduct(authGroup, id, data) {
		data.modifiedAt = Date.now();
		return Product.findOneAndUpdate({ _id: id, authGroup }, data, { new: true, overwrite: true });
	}
};