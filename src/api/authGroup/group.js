import jsonPatch from 'jsonpatch';
import Boom from '@hapi/boom';
import dal from './dal';
import plugins from '../plugins/plugins';
import helper from '../../helper';
import k from './generate-keys';
import iat from "../oidc/initialAccess/iat";
import n from "../plugins/notifications/notifications";
import ueEvents from "../../events/ueEvents";

const config = require('../../config');

const agp = {
	// @notTested
	async check(pName) {
		const docs = await dal.checkPrettyName(pName);
		return docs === 0;
	},

	async write(body) {
		const data = JSON.parse(JSON.stringify(body));
		// initial write should always be active false
		data.active = false;

		// set expiration date
		data.securityExpiration = new Date(Date.now() + (config.GROUP_SECURE_EXPIRES * 1000));

		// set primary domain
		if(data.primaryDomain && !data.primaryDomain.includes('://')) {
			data.primaryDomain = `https://${data.primaryDomain}`;
		}

		// if notifications are off
		if (!data.pluginOptions || !data.pluginOptions.notification || (data.pluginOptions && data.pluginOptions.notification && data.pluginOptions.notification.enabled !== true)){
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
		const output = await dal.write(data);
		ueEvents.emit(output._id || output.id, 'ue.group.create', output);
		return output;
	},

	async completeGroupSignup (group, globalSettings, owner) {
		const result = JSON.parse(JSON.stringify(group));
		const expiresIn = 86400 + config.GROUP_SECURE_EXPIRES;
		const token = await iat.generateIAT(expiresIn, ['auth_group'], result);
		result.initialAccessToken = token.jti;
		if(result.config) delete result.config.keys;
		if(globalSettings.notifications.enabled === true && config.ROOT_GROUP_REGISTRATION_UI_URL !== undefined){
			try {
				const nOps = agp.groupCreationNotifyOptions(result, owner);
				await n.notify(globalSettings, nOps, result);
			} catch (e) {
				result.warning = {
					message: 'Owner will not get a notification, there was an error',
					info: e.message
				};
			}
		} else result.warning = 'Owner will not get a notification, global settings are not enabled';
		ueEvents.emit(group._id || group.id, 'ue.group.initialize', result);
		return result;
	},

	// @notTested
	async get(q) {
		const query = await helper.parseOdataQuery(q);
		query.projection['config.keys'] = 0;
		return dal.get(query);
	},

	// @notTested
	async getOne(id) {
		return dal.getOneByEither(id, false);
	},

	// @notTested
	async deleteOne(id) {
		const result = await dal.deleteOne(id);
		ueEvents.emit(id, 'ue.group.destroy', result);
		return result;
	},

	async deleteOneCleanup(id) {
		const result = await dal.deleteOne(id, true);
		ueEvents.emit(id, 'ue.group.destroy', result);
		return result;
	},

	async getOneByEither(q, onlyIncludeActive=true) {
		return dal.getOneByEither(q, onlyIncludeActive);
	},

	async patch(group, update, user) {
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
		patched.modifiedBy = user;
		const result = await dal.patch(group.id || group._id, patched);
		ueEvents.emit(group.id || group._id, 'ue.group.edit', result);
		return result;
	},

	async switchGroupOwner(group, owner) {
		return dal.switchGroupOwner(group.id || group._id, owner);
	},

	async activateNewAuthGroup(authGroup, account, clientId) {
		const copy = JSON.parse(JSON.stringify(authGroup));
		copy.owner = account._id;
		copy.modifiedBy = account._id;
		copy.active = true;
		copy.__v = authGroup.__v;
		copy.associatedClient = clientId;
		delete copy.securityExpiration;
		const result = await dal.activatePatch(authGroup._id || authGroup.id, copy);
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.group.initialize', result);
		return result;
	},

	// @notTested
	async partialUpdate(id, data) {
		const result = await dal.patchNoOverwrite(id, data);
		ueEvents.emit(id, 'ue.group.edit', result);
		return result;
	},

	async operations(id, operation, user) {
		const userId = user.sub || 'SYSTEM';
		let keys;
		let result;
		switch (operation) {
		case 'rotate_keys':
			keys = await k.write();
			result = await dal.patchNoOverwrite(id, { modifiedBy: userId, 'config.keys': keys });
			ueEvents.emit(id, 'ue.group.edit', result);
			return result;
		default:
			throw Boom.badData('Unknown operation specified');
		}
	},

	// @notTested
	groupCreationNotifyOptions(authGroup, owner) {
		console.info(owner);
		return {
			iss: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}`,
			createdBy: owner,
			type: 'general',
			formats: ['email'],
			recipientEmail: owner,
			screenUrl: `${config.ROOT_GROUP_REGISTRATION_UI_URL}?group=${authGroup.id}&code=${authGroup.initialAccessToken}`,
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

export default agp;