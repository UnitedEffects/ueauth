import dal from '../dal';
import ueEvents from '../../../events/ueEvents';
import helper from '../../../helper';

export default {
	async createView(data) {
		const result = await dal.createView(data);
		ueEvents.emit(data.authGroup, 'ue.secured.profile.view.created', result);
		return result;
	},
	async getAllViews(authGroup, q, target, viewer) {
		const query = await helper.parseOdataQuery(q);
		return dal.getAllViews(authGroup, query, target, viewer);
	},
	async getView(authGroup, id, user) {
		return dal.getView(authGroup, id, user);
	},
	async checkView(authGroup, target, caller) {
		return dal.checkView(authGroup, target, caller);
	},
	async deleteView(authGroup, id, user) {
		const result = await dal.deleteView(authGroup, id, user);
		ueEvents.emit(authGroup, 'ue.secured.profile.view.destroyed', result);
		return result;
	}
};