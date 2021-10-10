import Role from './model';
import { nanoid } from 'nanoid';

export default {
	async writeRole(data) {
		data.codedId = nanoid(10);
		const role =  new Role(data);
		return role.save();
	},
	async getAllRoles(g, query) {
		query.query.authGroup = g;
		return Role.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getAllRolesAcrossProductsByOrg(g, o, query) {
		query.query.authGroup = g;
		query.query.$or = [
			{ organization: o },
			{ organization: { $exists: false } }
		];
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
		return Role.findOne( { $and: [ {$or: [
			{ _id: id },
			{ codedId: id }
		]}, {$or: [
			{ product },
			{ productCodedId: product }
		]}], authGroup });
	},
	async getRoleByOrgProdId(authGroup, product, organization, id) {
		return Role.findOne({ _id: id, authGroup, product, organization });
	},
	async deleteRoleByOrgProdId(authGroup, product, organization, id) {
		return Role.findOneAndRemove({ _id: id, authGroup, product, organization });
	},
	async getRoleByOrganizationAndId(authGroup, organization, id) {
		const query = {
			_id: id,
			authGroup,
			$or: [
				{ organization },
				{ organization: { $exists: false } }
			]
		};
		return Role.findOne(query);
	},
	async deleteRole(authGroup, product, id) {
		return Role.findOneAndRemove( { _id: id, authGroup, product });
	},
	async patchRole(authGroup, id, product, data) {
		data.modifiedAt = Date.now();
		const options = { new: true, overwrite: true, runValidators: true };
		return Role.findOneAndUpdate({ _id: id, authGroup, product }, data, options);
	},
	async patchOrganizationRole(authGroup, id, organization, product, data) {
		data.modifiedAt = Date.now();
		const options = { new: true, overwrite: true, runValidators: true };
		return Role.findOneAndUpdate({ _id: id, authGroup, organization, product }, data, options);
	},
	async checkProduct(authGroup, productId) {
		return Role.find( { authGroup, product: productId }).select( { _id: 1, name: 1, description: 1, productCodedId: 1});
	},
	async clearPermissionFromRoles(authGroup, product, coded) {
		return Role.updateMany({ authGroup, product }, { $pullAll: { permissions: [coded] } } );
	},
	async checkForPermissions(authGroup, product, coded) {
		return Role.find({ authGroup, product, permissions: coded }).select({ _id: 1});
	},
	async bulkWrite(roles) {
		return Role.insertMany(roles);
	},
	async deleteRolesOfProduct(authGroup, product) {
		return Role.deleteMany({ authGroup, product });
	},
	async updateCoreRole(query, update) {
		return Role.findOneAndUpdate(query, update, { new: true });
	}
};