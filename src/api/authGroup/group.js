import jsonPatch from 'jsonpatch';
import Boom from '@hapi/boom';
import dal from './dal';
import plugins from '../plugins/plugins';
import helper from '../../helper';
import k from './generate-keys';

export default {
	async check(pName) {
		const docs = await dal.checkPrettyName(pName);
		return docs === 0;
	},

	async write(data) {
		return dal.write(data);
	},

	async get(q) {
		const query = await helper.parseOdataQuery(q);
		query.projection['config.keys'] = 0;
		return dal.get(query);
	},

	async getOne(id) {
		return dal.getOneByEither(id, false);
	},

	async deleteOne(id) {
		return dal.deleteOne(id);
	},

	async getOneByEither(q, onlyIncludeActive=true) {
		return dal.getOneByEither(q, onlyIncludeActive);
	},

	async patch(group, update) {
		const patched = jsonPatch.apply_patch(group.toObject(), update);
		if(patched.pluginOptions.notification.enabled === true && group.pluginOptions.notification.enabled === false) {
			const globalSettings = await plugins.getLatestPluginOptions();
			if (globalSettings.notifications.enabled !== true) {
				throw Boom.methodNotAllowed('The Service Admin has not enabled Global Notifications. ' +
                    'This options is not currently possible for Auth Groups. Contact your admin to activate this feature.');
			}
		}
		return dal.patch(group.id, patched);
	},

	async switchGroupOwner(group, owner) {
		return dal.switchGroupOwner(group.id, owner);
	},

	async activateNewAuthGroup(authGroup, account, clientId) {
		const copy = JSON.parse(JSON.stringify(authGroup));
		copy.owner = account._id;
		copy.modifiedBy = account._id;
		copy.active = true;
		copy.__v = authGroup.__v;
		copy.associatedClient = clientId;
		delete copy.securityExpiration;
		return dal.activatePatch(authGroup._id || authGroup.id, copy);
	},

	async operations(id, operation) {
		switch (operation) {
		case 'rotate_keys':
			const keys = await k.write();
			return dal.patchNoOverwrite(id, { config: { keys }});
		default:
			throw Boom.badData('Unknown operation specified');
		}
	}
};