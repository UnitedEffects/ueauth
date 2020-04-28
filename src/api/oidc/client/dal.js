import Client from '../models/client';

export default {
    async get(authGroup, query) {
        if (authGroup.toLowerCase() !== 'all') query.query['payload.auth_group'] = authGroup;
        query.projection['payload'] = 1;
        // todo need to compensate query and projection for payload in the query params...
        const pipeline = [
            { $match: query.query },
            { $project: query.projection}
        ];
        if (query.sort && Object.keys(query.sort).length !== 0) pipeline.push({ $sort: query.sort });
        if (query.skip) pipeline.push({ $skip: query.skip });
        if (query.limit) pipeline.push({ $limit: query.limit });
        pipeline.push({ $replaceRoot: { newRoot: "$payload" } });
        pipeline.push({ $project: { 'client_secret': 0 } });
        return Client.aggregate(pipeline);
    },
    async getCount(authGroup, id, query) {
        if (authGroup.toLowerCase() !== 'all') query.query['payload.auth_group'] = authGroup;
        if (id) query.query['_id'] = { "$ne": id };
        return Client.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit).countDocuments();
    },
    async getOne(authGroup, id) {
        return Client.findOne( { _id: id, 'payload.auth_group': authGroup }).select({ 'payload.client_secret': 0 });
    }
};