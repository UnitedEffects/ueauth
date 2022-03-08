import dal from '../dal';
import view from './view';
import ueEvents from '../../../events/ueEvents';
import helper from '../../../helper';

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
	async updateRequestStatus(authGroup, id, state, target) {
		const result = await dal.updateRequestStatus(authGroup, id, state, target);
		switch (state) {
		case 'approved':
			ueEvents.emit(authGroup, 'ue.secured.profile.access.approved', result);
			switch (result.type) {
			case 'sync':
				break;
			case 'access':
				await setAccess(result);
				break;
			case 'copy':
				break;
			default:
				break;
			}
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

async function setAccess(result) {
	console.info(result);
	const accessObject = {
		authGroup: result.authGroup,
		viewingAccountId: result.requestingAccountId,
		viewingEmail: result.requestingEmail,
		accessDetails: result.requestDetails,
		targetAccountId: result.targetAccountId
	};
	if(result.accessExpirationTime !== 'unlimited') {
		const exDate = new Date();
		const days = parseInt(result.accessExpirationTime);
		accessObject.expiresAt = exDate.setDate(exDate.getDate() + days);
	}
	return view.createView(accessObject);
}