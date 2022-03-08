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
		if(profile) data.snapShot = profile;
		const result = await dal.takeSnap(data);
		ueEvents.emit(authGroup, 'ue.secured.profile.copy.created', result);
		return result;
	},
    async addSnapShot(authGroup, requestId, accountId, profile) {
	    return dal.updateSnap(authGroup, requestId, accountId, 'approve', profile);
    },
    async deny(authGroup, requestId, accountId) {
        return dal.updateSnap(authGroup, requestId, accountId, 'denied');
    },
	async getSnapShot(authGroup, id, caller) {
		return dal.getSnapShot(authGroup, id, caller);
	},
	async deleteSnapShot(authGroup, id, caller) {
		return dal.deleteSnapShot(authGroup, id, caller);
	}
};