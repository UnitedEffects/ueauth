import getModel from './models/model';
import { snakeCase } from 'lodash';

class MongoAdapter {
	constructor(name) {
		this.name = snakeCase(name);
	}
    
	async upsert(_id, payload, expiresIn) {
		let expiresAt;

		if (expiresIn) {
			expiresAt = new Date(Date.now() + (expiresIn * 1000));
		}

		return this.coll().findOneAndUpdate(
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
		return this.coll().deleteOne({ _id });
	}

	async revokeByGrantId(grantId) {
		return this.coll().deleteMany({ 'payload.grantId': grantId });
	}

	async consume(_id) {
		return this.coll().findOneAndUpdate(
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