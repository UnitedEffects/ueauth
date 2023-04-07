import Boom from '@hapi/boom';
import Group from './model';
import ueEvents from '../../events/ueEvents';

export default {
	async write(data) {
		const group = new Group(data);
		// we publish first to ensure we don't ever create a local record without an async streamed record
		// this only matters if the externalStreaming plugin and masterStream option are enabled
		try {
			await ueEvents.master(group._id, 'ue.group.create', group);
		} catch (error) {
			console.error(error);
			throw Boom.failedDependency('Master streaming is enabled but did not work. Rolling back request to avoid falling out of sync with event record');
		}

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
				{ prettyName: q?.toLowerCase() },
				{ aliasDnsUi: q?.toLowerCase() }
			]};
		return Group.findOne(query);
	},
	async patch(id, data) {
		data.modifiedAt = Date.now();
		return Group.findOneAndReplace({ _id: id, active: true }, data, { new: true, overwrite: true });
	},
	async patchNoOverwrite(id, data, q = undefined) {
		const filter = (q) ? { _id: id, active: true, ...q } : { _id: id, active: true };
		data.modifiedAt = Date.now();
		return Group.findOneAndUpdate(filter, data, { new: true });
	},
	async activatePatch(id, data) {
		data.modifiedAt = Date.now();
		return Group.findOneAndReplace({ _id: id, active: false }, data, { new: true, overwrite: true });
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