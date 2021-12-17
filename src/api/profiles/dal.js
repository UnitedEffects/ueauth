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
	async getAllMyOrgProfiles(authGroup, accountId) {
		return OrgProfile.aggregate([
			{
				$match: { authGroup, accountId }
			},
			{
				$lookup:
					{
						from: 'organizations',
						localField: 'organization',
						foreignField: '_id',
						as: 'organization'
					}
			},
			{
				$project: {
					organizationProfileId: '$_id',
					_id: 0,
					createdAt: 1,
					modifiedAt: 1,
					deleteRequested: 1,
					deleteRequestedDate: 1,
					organizationName: {$first: '$organization.name'},
					organizationId: {$first: '$organization._id'},
					contactEmail: {$first: '$organization.contactEmail'},
					authGroup: 1
				}
			}
		]);
	},
	async myProfileRequest(authGroup, organization, accountId, request) {
		let result;
		switch (request) {
		case 'remove':
			result = await OrgProfile.findOneAndUpdate({ authGroup, organization, accountId}, { deleteRequested: true, deleteRequestedDate: Date.now()}, { new: true});
			if(!result || result.deleteRequested !== true) {
				return {
					request: 'remove',
					verified: false
				};
			}
			return {
				orgProfileId: result._id,
				request: 'remove',
				verified: true,
				date: result.deleteRequestedDate
			};
		case 'remain':
			result = await OrgProfile.findOneAndUpdate( { authGroup, organization, accountId}, {deleteRequested: false, $unset: { deleteRequestedDate: 1 }}, { new: true });
			if(!result || result.deleteRequested !== false) {
				return {
					request: 'remain',
					verified: false
				};
			}
			return {
				orgProfileId: result._id,
				request: 'remain',
				verified: true
			};
		default:
			return undefined;
		}
	}
};