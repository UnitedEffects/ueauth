import OrgProfile from './models/orgProfile';
import Profile from './models/securedProfile';
import View from './models/viewAccess';
import Request from './models/request';

export default {
	/* VIEW ACCESS */
	async createView(data) {
		const view = new View(data);
		return view.save();
	},
	async getAllViews(g, query, targetAccountId, viewingAccountId) {
		query.query.authGroup = g;
		if(targetAccountId) query.query.targetAccountId = targetAccountId;
		if(viewingAccountId) query.query.viewingAccountId = viewingAccountId;
		return View.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getView(authGroup, _id, user) {
		const q = { _id, authGroup, $or: [ { targetAccountId: user }, { viewingAccountId: user } ] };
		return View.findOne(q);
	},
	async deleteView(authGroup, _id, user) {
		const q = { _id, authGroup, $or: [ { targetAccountId: user }, { viewingAccountId: user } ] };
		return View.findOneAndRemove(q);
	},
	/* PROFILE REQUESTS */
	async createRequest(data) {
		const request = new Request(data);
		return request.save();
	},
	async getRequests(g, query, targetAccountId, requestingAccountId) {
		query.query.authGroup = g;
		if(targetAccountId) query.query.targetAccountId = targetAccountId;
		if(requestingAccountId) query.query.requestingAccountId = requestingAccountId;
		return Request.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getRequest(authGroup, _id, user) {
		const q = { _id, authGroup, $or: [ { targetAccountId: user }, { requestingAccountId: user } ] };
		return Request.findOne(q);
	},
	async deleteRequest(authGroup, _id, user) {
		const q = { _id, authGroup, $or: [ { targetAccountId: user }, { requestingAccountId: user } ] };
		return Request.findOneAndRemove(q);
	},
	async updateRequestStatus(authGroup, _id, state, targetAccountId) {
		const q = { _id, authGroup, targetAccountId};
		const data = {
			modifiedAt: Date.now(),
			modifiedBy: targetAccountId,
			state
		};
		return Profile.findOneAndUpdate(q, data, { new: true });
	},
	/* SECURED PROFILES */
	async writeProfile(data) {
		const profile = new Profile(data);
		return profile.save();
	},
	// not exposed publicly and limited to root
	async getProfiles(g, query) {
		query.query.authGroup = g;
		return Profile.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getProfile(authGroup, id) {
		return Profile.findOne( { authGroup, $or: [{ _id: id }, { accountId: id }] });
	},
	async deleteProfile(authGroup, id) {
		return Profile.findOneAndRemove( { authGroup, $or: [{ _id: id }, { accountId: id }] });
	},
	async patchProfile(authGroup, id, data) {
		data.modifiedAt = Date.now();
		return Profile.findOneAndUpdate({
			authGroup, $or: [{ _id: id }, { accountId: id }] }, data, { new: true, overwrite: true });
	},
	/* ORG PROFILES */
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