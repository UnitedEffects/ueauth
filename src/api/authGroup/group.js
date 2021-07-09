import jsonPatch from 'jsonpatch';
import Boom from '@hapi/boom';
import dal from './dal';
import plugins from '../plugins/plugins';
import helper from '../../helper';
import k from './generate-keys';

const config = require('../../config');

export default {
	async check(pName) {
		const docs = await dal.checkPrettyName(pName);
		return docs === 0;
	},

	async write(data) {
		// if notifications are off
		if (data.pluginOptions && data.pluginOptions.notification && data.pluginOptions.notification.enabled !== true){
			// if no config was set, there is no issue
			if (data.config) {
				// can not have passwordless support without notifications
				data.config.passwordLessSupport = false;
				// can not use requireVerify when there are no notifications and group is public
				if(data.locked === false) {
					data.config.requireVerified = false;
					data.config.autoVerify = false;
				}
			}
		}
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
		if(patched.config.autoVerify === true && patched.pluginOptions.notification.enabled === false) {
			throw Boom.methodNotAllowed('Automatic account verification requires that you activate or keep active notifications');
		}
		// if notifications are off
		if (patched.pluginOptions && patched.pluginOptions.notification && patched.pluginOptions.notification.enabled !== true){
			// if no config was set, there is no issue
			if (patched.config) {
				// can not have passwordless support without notifications
				if(patched.config.passwordLessSupport === true) {
					throw Boom.methodNotAllowed('You can not set passwordless to true without notifications');
				}
				// can not use requireVerify when there are no notifications and group is public
				if(patched.locked === false) {
					if (patched.config.requireVerified === true || patched.config.autoVerify === true) {
						throw Boom.methodNotAllowed('As a public authGroup, you can not force verification without also enabling notifications');
					}
				}
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

	async partialUpdate(id, data) {
		return dal.patchNoOverwrite(id, data);
	},

	async operations(id, operation) {
		switch (operation) {
		case 'rotate_keys':
			const keys = await k.write();
			return dal.patchNoOverwrite(id, { config: { keys }});
		default:
			throw Boom.badData('Unknown operation specified');
		}
	},

	groupCreationNotifyOptions(authGroup, owner) {
		console.info(authGroup);
		return {
			iss: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}`,
			createdBy: owner,
			type: 'general',
			formats: ['email'],
			recipientEmail: owner,
			// todo - finalize the screen url after UX
			screenUrl: `${config.PROTOCOL}://${config.UI_URL}/${authGroup.id}/register?code=${authGroup.initialAccessToken}`,
			subject: `${authGroup.name} - Register Your Ownership Account`,
			message: `You created a new auth group called '${authGroup.name}'. In order to complete the creation process and activate the group, you must register your account with the same email address that you used to create the group.`,
			meta: {
				description: 'Direct API Post Call',
				token: authGroup.initialAccessToken,
				apiHeader: `bearer ${authGroup.initialAccessToken}`,
				apiUri: `${config.PROTOCOL}://${config.SWAGGER}/api/${authGroup.id}/user`,
				apiMethod: 'POST',
				apiBody: {
					username: owner,
					email: owner,
					password: 'INSERT-PASSWORD-HERE'
				}
			}
		};
	},
};