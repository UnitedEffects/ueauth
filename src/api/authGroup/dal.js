import Group from './model';

export default {
	async write(data) {
		const group = new Group(data);
		return group.save();
	},
	async get(query) {
		return Group.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getOne(id) {
		return Group.findOne( { _id: id });
	},
	async findByAliasDNS(aliasDnsOIDC) {
		if(aliasDnsOIDC === undefined) return undefined;
		return Group.findOne( { aliasDnsOIDC });
	},
	async getOneByEither(q, onlyIncludeActive=true) {
		const query = {
			$or: [
				{ _id: q },
				{ prettyName: q }
			]};
		if(onlyIncludeActive === true) query.active = true;
		return Group.findOne(query);
	},
	async getPublicOne(q) {
		const query = {
			active: true,
			$or: [
				{ _id: q },
				{ prettyName: q },
				{ aliasDnsUi: q }
			]};
		return Group.findOne(query);
	},
	async patch(id, data) {
		data.modifiedAt = Date.now();
		return Group.findOneAndUpdate({ _id: id, active: true }, data, { new: true, overwrite: true });
	},
	async patchNoOverwrite(id, data, q = undefined) {
		const filter = (q) ? { _id: id, active: true, ...q } : { _id: id, active: true };
		data.modifiedAt = Date.now();
		return Group.findOneAndUpdate(filter, data, { new: true });
	},
	async activatePatch(id, data) {
		data.modifiedAt = Date.now();
		return Group.findOneAndUpdate({ _id: id, active: false }, data, { new: true, overwrite: true });
	},
	async checkPrettyName(prettyName) {
		return Group.find({ prettyName }).countDocuments();
	},
	async deleteOne(id, active = false) {
		return Group.findOneAndRemove({ _id: id, active });
	},
	async switchGroupOwner(id, owner) {
		return Group.findOneAndUpdate({ _id: id }, { owner }, { new: true });
	}
};