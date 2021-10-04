import Permission from './model';

export default {
	async writePermission(data) {
		const perm =  new Permission(data);
		return perm.save();
	},
	async getPermissions(g, p, query) {
		query.query.authGroup = g;
		query.query.product = p;
		return Permission.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getPermission(authGroup, product, id) {
		return Permission.findOne( { _id: id, product, authGroup });
	},
	async deletePermission(authGroup, product, id) {
		return Permission.findOneAndRemove( { _id: id, authGroup, product });
	},
	async deletePermissionsByProduct(authGroup, product) {
		return Permission.deleteMany({ authGroup, product });
	},
	async checkForProductReference(authGroup, product) {
		return Permission.find({ authGroup, product }).select({ _id: 1 });
	},
	async bulkWrite(permissions) {
		return Permission.insertMany(permissions);
	}
};