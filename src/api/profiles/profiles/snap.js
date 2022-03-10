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
		const event =JSON.parse(JSON.stringify(result));
		delete event.snapShot;
		ueEvents.emit(authGroup, 'ue.secured.profile.copy.created', event);
		return result;
	},
    async addSnapShot(authGroup, requestId, accountId, profile) {
	    const result = await dal.updateSnap(authGroup, requestId, accountId, 'approve', profile);
		const event =JSON.parse(JSON.stringify(result));
		delete event.snapShot;
		ueEvents.emit(authGroup, 'ue.secured.profile.copy.updated', event);
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
		const event =JSON.parse(JSON.stringify(result));
		delete event.snapShot;
		ueEvents.emit(authGroup, 'ue.secured.profile.copy.destroyed', event);
		return result;
	}
};