import Client from '../models/client';


function definePipeline(authGroup, query, search = undefined) {
	if(query.query) {
		Object.keys(query.query).forEach((key) => {
			query.query[`payload.${key}`] = query.query[key];
			delete query.query[key];
		});
	}
	query.query.$or = [{ 'payload.auth_group': authGroup._id }, { 'payload.auth_group': authGroup.prettyName }];
	if(search) {
		query.query['$text'] = { $search : search };
	}
	if(query.projection) {
		if(Object.keys(query.projection).length !== 0) {
			Object.keys(query.projection).forEach((key) => {
				query.projection[`payload.${key}`] = query.projection[key];
				delete query.projection[key];
			});
		}
		/*
		if(Object.keys(query.projection).length === 0) {
			query.projection['payload'] = 1;
		} else {
			Object.keys(query.projection).forEach((key) => {
				query.projection[`payload.${key}`] = query.projection[key];
				delete query.projection[key];
			});
		}
		 */
	}
	if(query.sort) {
		Object.keys(query.sort).forEach((key) => {
			query.sort[`payload.${key}`] = query.sort[key];
			delete query.sort[key];
		});
	}
	const pipeline = [
		{ $match: query.query }
	];
	if (query.projection && Object.keys(query.projection).length !== 0) pipeline.push({ $project: query.projection});
	if (query.sort && Object.keys(query.sort).length !== 0) pipeline.push({ $sort: query.sort });
	if (query.skip) pipeline.push({ $skip: query.skip });
	if (query.limit) pipeline.push({ $limit: query.limit });
	pipeline.push({
		$replaceRoot: {
			newRoot: {
				$mergeObjects: [
					'$$ROOT', '$payload'
				]
			}
		}
	});
	pipeline.push({
		$unset: ['payload', '_id', '__v']
	});
	pipeline.push({ $project: { 'client_secret': 0 } });
	return pipeline;
}

export default {
	async get(authGroup, query, search = undefined, agg = undefined) {
		const pipeline = agg || definePipeline(authGroup, query, search);
		return Client.aggregate(pipeline);
	},
	async getProductKeys(authGroup, product, query) {
		query.query.associated_product = product;
		query.query.client_label = 'product-key';
		const result = await this.get(authGroup, query);
		const output = [];
		if(result?.length) {
			result.map((c) => {
				output.push({
					authGroup: c.auth_group,
					clientId: c.client_id,
					productId: product,
					name: c.client_name,
					organizationId: c.initialized_org_context,
					roles: c.access?.roles
				});
			});
		}
		return output;
	},
	async getCount(authGroup, id, clientName) {
		const query = { query: { 'payload.client_name': clientName } };
		query.query.$or = [{ 'payload.auth_group': authGroup._id }, { 'payload.auth_group': authGroup.prettyName }];
		if (id) query.query['_id'] = { '$ne': id };
		return Client.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit).countDocuments();
	},
	async getOne(authGroup, id) {
		return Client.findOne({
			_id: id,
			$or: [{ 'payload.auth_group': authGroup._id }, { 'payload.auth_group': authGroup.prettyName }]
		}).select({ 'payload.client_secret': 0 });
	},
	async getOneByAgId(agId, id) {
		return Client.findOne({ _id: id, 'payload.auth_group': agId });
	},
	async getOneByNameAndAG(authGroup, name) {
		const result = await Client.findOne({
			'payload.client_name': name,
			$or: [{ 'payload.auth_group': authGroup._id }, { 'payload.auth_group': authGroup.prettyName }]
		}).select({ payload: 1 });
		if(result && result.payload) return result.payload;
		return result;
	},
	async getOneByName(authGroup, name) {
		const agId = authGroup._id || authGroup.id;
		return Client.findOne({
			'payload.client_name': name,
			$or: [{ 'payload.auth_group': agId }, { 'payload.auth_group': authGroup.prettyName }]
		}).select({ 'payload.client_secret': 0 });
	},
	async getOneFull(authGroup, id) {
		return Client.findOne({
			_id: id,
			$or: [{ 'payload.auth_group': authGroup._id }, { 'payload.auth_group': authGroup.prettyName }]
		});
	},
	async patchOne(authGroup, id, data) {
		return Client.findOneAndReplace({
			_id: id,
			$or: [{'payload.auth_group': authGroup._id}, {'payload.auth_group': authGroup.prettyName}]
		}, data, {new: true, overwrite: true}).select({payload: 1});
	},
	async simplePatch(authGroup, id, data) {
		return Client.findOneAndUpdate({
			_id: id,
			'payload.auth_group': authGroup
		}, data, {new: true });
	},
	async deleteOne(authGroup, id) {
		return Client.findOneAndRemove({ _id: id, $or: [{ 'payload.auth_group': authGroup._id }, { 'payload.auth_group': authGroup.id }, { 'payload.auth_group': authGroup.prettyName }] });
	},
	async deleteProductKeyService(authGroup, product, id, orgContext) {
		const filter = { _id: id, 'payload.associated_product': product, 'payload.auth_group': authGroup };
		if(orgContext) {
			filter['payload.initialized_org_context'] = orgContext;
		}
		const result = await Client.findOneAndRemove(filter);
		return result;
	},
	async getProductKeyService(authGroup, product, id) {
		return Client.findOne({ _id: id, 'payload.associated_product': product, 'payload.auth_group': authGroup });
	},
	async rotateSecret(id, authGroup, client_secret) {
		return Client.findOneAndUpdate({
			_id: id,
			$or: [{ 'payload.auth_group': authGroup._id }, { 'payload.auth_group': authGroup.prettyName }]
		}, { 'payload.client_secret': client_secret }, {new: true}).select({payload: 1});
	},
	async removeClientAccess(authGroup, id, product) {
		return Client.findOneAndUpdate( {
			_id: id,
			'payload.auth_group': authGroup,
			'access.product': product
		}, { access: {} }, { new: true })
			.select({ _id: 1, access: 1, 'payload.auth_group': 1 });
	},
	async getClientAccess(authGroup, id) {
		return Client.findOne({
			_id: id,
			'payload.auth_group': authGroup.id
		}).select({ _id: 1, access: 1, 'payload.auth_group': 1 });
	},
	async applyClientAccess(authGroup, id, access, args = {}) {
		const filter = {
			_id: id,
			'payload.auth_group': authGroup,
			...args
		};
		return Client.findOneAndUpdate(filter, { access }, { new: true })
			.select({ _id: 1, access: 1, 'payload.auth_group': 1 });
	},
	async checkRoles(authGroup, id) {
		const clients = await Client.find({ 'payload.auth_group': authGroup, access: { roles: id }}).limit(100).select({ _id: 1, 'payload.client_name': 1, 'payload.auth_group': 1, 'payload.associated_product': 1});
		const output = [];
		if(clients) {
			clients.map((c) => {
				output.push({
					id: c._id,
					authGroup: c.payload.auth_group,
					name: c.payload.client_name,
					product: c.payload.associated_product
				});
			});
		}
		return output;
	},
};