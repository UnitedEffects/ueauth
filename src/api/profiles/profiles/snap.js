import dal from '../dal';
import ueEvents from '../../../events/ueEvents';

export default {
	async takeSnap(authGroup, accountId, requestId, callerId, profile) {
        const data = {
            authGroup,
			accountId,
			requestId,
			callerId
        };
		if(profile) {
			data.snapShot = profile;
			data.status = 'approved';
		}
		const result = await dal.takeSnap(data);
		ueEvents.emit(authGroup, 'ue.secured.profile.copy.created', result);
		return result;
	},
    async addSnapShot(authGroup, requestId, accountId, profile) {
	    const result = await dal.updateSnap(authGroup, requestId, accountId, 'approve', profile);
		ueEvents.emit(authGroup, 'ue.secured.profile.copy.updated', result);
		return result;
    },
    async deny(authGroup, requestId, accountId) {
        return dal.updateSnap(authGroup, requestId, accountId, 'denied');
    },
	async getSnapShot(authGroup, id, caller) {
		return dal.getSnapShot(authGroup, id, caller);
	},
	async deleteSnapShot(authGroup, id, caller) {
		const result  = await dal.deleteSnapShot(authGroup, id, caller);
		ueEvents.emit(authGroup, 'ue.secured.profile.copy.destroyed', result);
		return result;
	}
};