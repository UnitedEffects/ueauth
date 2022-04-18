import Product from './model';
import { nanoid } from 'nanoid';

export default {
	async writeProduct(data) {
		data.codedId = nanoid(10);
		if(!data.meta) data.meta = {};
		const product =  new Product(data);
		return product.save();
	},
	async getProducts(g, query) {
		query.query.authGroup = g;
		return Product.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getTheseProducts(authGroup, idArray) {
		return Product.find({ _id: { $in: idArray}, authGroup })
			.select({ _id: 1, codedId: 1, authGroup: 1, name: 1, description: 1, b2c: 1, url: 1 });
	},
	async getB2cProducts(authGroup) {
		return Product.find({ authGroup, b2c: true, core: { $ne: true }})
			.select({ _id: 1, codedId: 1, name: 1, description: 1, url: 1});
	},
	async getMyProducts(authGroup, idArray, core = false) {
		const filter = (core === true) ? {
			_id: { $in: idArray},
			authGroup,
			b2c: { $ne: true }
		} : {
			_id: { $in: idArray},
			authGroup,
			b2c: { $ne: true },
			core: { $ne: true }
		};
		return Product.find(filter)
			.select({ _id: 1, codedId: 1, name: 1, description: 1, url: 1 });
	},
	async getProduct(authGroup, id) {
		return Product.findOne( { authGroup, $or: [{ _id: id }, { codedId: id }] });
	},
	async getThisProduct(authGroup, id) {
		return Product.findOne( { authGroup, $or: [{ _id: id }, { codedId: id }] })
			.select({ _id: 1, codedId: 1, authGroup: 1, name: 1, description: 1, b2c: 1, url: 1 });
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
	},
	async addAssociatedClient(authGroup, id, clientId) {
		const product = await Product.findOne({ _id: id, authGroup });
		if(product) {
			if(!product.associatedClients) product.associatedClients = [];
			product.associatedClients.push(clientId);
			//ensure no duplicates
			product.associatedClients = [...new Set(product.associatedClients)];
			return product.save();
		}
		return product;
	},
	async removeAssociatedClient(authGroup, id, clientId) {
		const product = await Product.findOne({ _id: id, authGroup });
		if(product) {
			if(!product.associatedClients || product.associatedClients.length === 0) return product;
			product.associatedClients = product.associatedClients.filter((c) => {
				return c !== clientId;
			});
			return product.save();
		}
		return product;
	},
};