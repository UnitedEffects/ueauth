import Client from '../models/client';

export default {
	async get(authGroup, query) {
		Object.keys(query.query).forEach((key) => {
			query.query[`payload.${key}`] = query.query[key];
			delete query.query[key];
		})
		query.query.$or = [{ 'payload.auth_group': authGroup._id }, { 'payload.auth_group': authGroup.prettyName }];
		if(query.projection && Object.keys(query.projection).length === 0) {
			query.projection['payload'] = 1;
		} else {
			Object.keys(query.projection).forEach((key) => {
				query.projection[`payload.${key}`] = query.projection[key];
				delete query.projection[key];
			})
		}
		Object.keys(query.sort).forEach((key) => {
			query.sort[`payload.${key}`] = query.sort[key];
			delete query.sort[key];
		})
		const pipeline = [
			{ $match: query.query },
			{ $project: query.projection}
		];
		if (query.sort && Object.keys(query.sort).length !== 0) pipeline.push({ $sort: query.sort });
		if (query.skip) pipeline.push({ $skip: query.skip });
		if (query.limit) pipeline.push({ $limit: query.limit });
		pipeline.push({ $replaceRoot: { newRoot: '$payload' } });
		pipeline.push({ $project: { 'client_secret': 0 } });
		return Client.aggregate(pipeline);
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
	async getOneByName(authGroup, name) {
		return Client.findOne({
			'payload.client_name': name,
			$or: [{ 'payload.auth_group': authGroup._id }, { 'payload.auth_group': authGroup.prettyName }]
		}).select({ 'payload.client_secret': 0 });
	},
	async getOneFull(authGroup, id) {
		return Client.findOne({
			_id: id,
			$or: [{ 'payload.auth_group': authGroup._id }, { 'payload.auth_group': authGroup.prettyName }]
		});
	},
	async patchOne(authGroup, id, data) {
		return Client.findOneAndUpdate({
			_id: id,
			$or: [{'payload.auth_group': authGroup._id}, {'payload.auth_group': authGroup.prettyName}]
		}, data, {new: true, overwrite: true}).select({payload: 1});
	},
	async deleteOne(authGroup, id) {
		return Client.findOneAndRemove({ _id: id, $or: [{ 'payload.auth_group': authGroup._id }, { 'payload.auth_group': authGroup.id }, { 'payload.auth_group': authGroup.prettyName }] });
	},
	async rotateSecret(id, authGroup, client_secret) {
		return Client.findOneAndUpdate({
			_id: id,
			$or: [{ 'payload.auth_group': authGroup._id }, { 'payload.auth_group': authGroup.prettyName }]
		}, { 'payload.client_secret': client_secret }, {new: true}).select({payload: 1});
	}
};