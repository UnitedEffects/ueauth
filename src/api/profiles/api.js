import Boom from '@hapi/boom';
import permissions from '../../permissions';
import profiles from './profiles';
import ueEvents from '../../events/ueEvents';
import {say} from '../../say';
import n from '../plugins/notifications/notifications';

const ORG_RESOURCE = 'Organization User Profile';
//const SEC_RESOURCE = 'Secured Profile';

export default {
	async writeOrgProfile(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must specify an Organization');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			const data = {
				organization: req.organization.id,
				authGroup: req.authGroup.id,
				...req.body
			};
			const result = await profiles.writeOrgProfile(data);
            await tryNotification(req, result);
			return res.respond(say.created(result, ORG_RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.organization.profile.error', error);
			next(error);
		}
	},
	async getOrgProfiles(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must specify an Organization');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			const result = await profiles.getOrgProfiles(req.authGroup.id, req.organization.id, req.query);
			return res.respond(say.ok(result, ORG_RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getOrgProfile(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must specify an Organization');
			if(!req.params.id) throw Boom.badRequest('No ID provided');
			// Allow Account holders to query this record using their Account Id
			if(req.user.sub !== req.params.id) {
				await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			}
			const result = await profiles.getOrgProfile(req.authGroup.id, req.organization.id, req.params.id);
			return res.respond(say.ok(result, ORG_RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async deleteOrgProfile(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must specify an Organization');
			if(!req.params.id) throw Boom.badRequest('No ID provided');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			const result = await profiles.deleteOrgProfile(req.authGroup.id, req.organization.id, req.params.id);
            await tryNotification(req, result);
			return res.respond(say.ok(result, ORG_RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.organization.profile.error', error);
			next(error);
		}
	},
	async patchOrgProfile(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must specify an Organization');
			if(!req.params.id) throw Boom.badRequest('No ID provided');
			// Allow Account holders to query this record using their Account Id
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			const profile = await profiles.getOrgProfile(req.authGroup.id, req.organization.id, req.params.id);
			const result = await profiles.patchOrgProfile(req.authGroup.id, req.organization.id, profile, req.params.id, req.body, req.user.sub || 'SYSTEM ADMIN');
            await tryNotification(req, result);
			return res.respond(say.ok(result, ORG_RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.organization.profile.error', error);
			next(error);
		}
	}
};

async function tryNotification(req, result) {
    try {
        if (req.globalSettings && req.globalSettings.notifications.enabled === true &&
            req.authGroup.pluginOptions.notification.enabled === true &&
            req.organization.profileNotifications === true) {
            await notifyUser(req.globalSettings, req.authGroup, req.organization.name, result.accountId, req.user.sub || 'SYSTEM ADMIN', JSON.parse(JSON.stringify(result)));
        }
    } catch (error) {
        ueEvents.emit(req.authGroup.id, 'ue.organization.profile.error', {notification: 'failed', error});
    }
}

async function notifyUser(globalSettings, authGroup, organizationName, userId, activeUser, profile) {
	const sendObject = await profiles.profileUpdateNotification(authGroup, organizationName, userId, activeUser, [], profile);
	return n.notify(globalSettings, sendObject, authGroup);
}