import OrgProfile from './models/orgProfile';

export default {
	async writeOrgProfile(data) {
		const orgProfile = new OrgProfile(data);
		return orgProfile.save();
	},
	async getOrgProfiles(g, o, query) {
		query.query.authGroup = g;
		query.query.organization = o;
		return OrgProfile.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getOrgProfile(authGroup, organization, id) {
		return OrgProfile.findOne( { authGroup, organization, $or: [{ _id: id }, { accountId: id }, { externalId: id }] });
	},
	async deleteOrgProfile(authGroup, organization, id) {
		return OrgProfile.findOneAndRemove( { authGroup, organization, $or: [{ _id: id }, { accountId: id }] });
	},
	async deleteAllOrgProfiles(authGroup, organization) {
		return OrgProfile.deleteMany({ authGroup, organization });
	},
	async patchOrgProfile(authGroup, organization, id, data) {
		data.modifiedAt = Date.now();
		return OrgProfile.findOneAndUpdate({ authGroup, organization, $or: [{ _id: id }, { accountId: id }] }, data, { new: true, overwrite: true });
	},
};