import dal from '../dal';
import ueEvents from '../../../events/ueEvents';
import helper from '../../../helper';

/**
 *
 'ue.secured.profile.create', (done)
 'ue.secured.profile.edit', (done)
 'ue.secured.profile.destroy', (done)
 'ue.secured.profile.error',
 'ue.secured.profile.organization.synced',
 'ue.secured.profile.copy.created',
 'ue.secured.profile.access.denied', (done)
 'ue.secured.profile.access.approved', (done)
 'ue.secured.profile.access.requested', (done)
 *
 */

export default {
	async createRequest(data) {
		const result = await dal.createRequest(data);
		ueEvents.emit(data.authGroup, 'ue.secured.profile.access.requested', result);
		return result;
	},
	// this is limited to your requests... if we want a broader query, we will need permissions defined for this API
	async getMyRequests(authGroup, q, target, sender) {
		const query = await helper.parseOdataQuery(q);
		return dal.getRequests(authGroup, query, target, sender);
	},
	async getRequest(authGroup, id, user) {
		return dal.getRequest(authGroup, id, user);
	},
	async deleteRequest(authGroup, id, user) {
		return dal.deleteRequest(authGroup, id, user);
	},
	// triggers?
	async updateRequestStatus(authGroup, id, state, target) {
		const result = await dal.updateRequestStatus(authGroup, id, state, target);
		switch (state) {
		case 'approved':
			ueEvents.emit(authGroup, 'ue.secured.profile.access.approved', result);
			break;
		case 'denied':
			ueEvents.emit(authGroup, 'ue.secured.profile.access.denied', result);
			break;
		default:
			break;
		}
		return result;
	}
};