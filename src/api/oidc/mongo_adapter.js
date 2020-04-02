import getModel from './models/model';
const snakeCase = require('lodash.snakecase');

/*
const grantable = new Set([
    'access_token',
    'authorization_code',
    'refresh_token',
    'device_code',
]);

class CollectionSet extends Set {
    add(name) {
        const nu = this.has(name);
        console.info(nu);
        super.add(name);
        if (!nu) {
            console.info('adding collection and indexes');
            DB.collection(name).createIndexes([
                ...(grantable.has(name)
                    ? [{
                        key: { 'payload.grantId': 1 },
                    }] : []),
                ...(name === 'device_code'
                    ? [{
                        key: { 'payload.userCode': 1 },
                        unique: true,
                    }] : []),
                ...(name === 'session'
                    ? [{
                        key: { 'payload.uid': 1 },
                        unique: true,
                    }] : []),
                {
                    key: { expiresAt: 1 },
                    expireAfterSeconds: 0,
                },
            ]).catch(console.error); // eslint-disable-line no-console
        } else console.info('already exists');

    }
}

const collections = new CollectionSet();
*/

class MongoAdapter {
    constructor(name) {
        this.name = snakeCase(name);
    }
    
    async upsert(_id, payload, expiresIn) {
        let expiresAt;

        if (expiresIn) {
            expiresAt = new Date(Date.now() + (expiresIn * 1000));
        }

        await this.coll().findOneAndUpdate(
            { _id },
            { $set: { payload, ...(expiresAt ? { expiresAt } : undefined) } },
            { upsert: true, setDefaultsOnInsert: true },
        );
    }

    async find(_id) {
        const result = await this.coll().collection.find(
            { _id },
            { payload: 1 },
        ).limit(1).next();

        if (!result) return undefined;
        return result.payload;
    }

    async findByUserCode(userCode) {
        const result = await this.coll().collection.find(
            { 'payload.userCode': userCode },
            { payload: 1 },
        ).limit(1).next();

        if (!result) return undefined;
        return result.payload;
    }

    async findByUid(uid) {
        const result = await this.coll().collection.find(
            { 'payload.uid': uid },
            { payload: 1 },
        ).limit(1).next();

        if (!result) return undefined;
        return result.payload;
    }

    async destroy(_id) {
        await this.coll().deleteOne({ _id });
    }

    async revokeByGrantId(grantId) {
        await this.coll().deleteMany({ 'payload.grantId': grantId });
    }

    async consume(_id) {
        await this.coll().findOneAndUpdate(
            { _id },
            { $set: { 'payload.consumed': Math.floor(Date.now() / 1000) } },
        );
    }

    coll(name) {
        return this.constructor.col(name || this.name);
    }

    static col(name) {
        return getModel(name);
    }
}

module.exports = MongoAdapter;