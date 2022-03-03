import Boom from '@hapi/boom';
import permissions from '../../permissions';
import orgProfiles from './profiles/org';
import profiles from './profiles/profile';
import ueEvents from '../../events/ueEvents';
import {say} from '../../say';
import n from '../plugins/notifications/notifications';

const ORG_RESOURCE = 'Organization User Profile';
const SEC_RESOURCE = 'Secured Profile';

export default {
	/* Secured Profiles */
	async writeProfile(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.user.sub) throw Boom.forbidden();
			const accountId = req.user.sub;
			if(req.body.accountId) delete req.body.accountId;
			const data = {
				authGroup: req.authGroup.id,
				accountId,
				...req.body
			};
			const result = await profiles.writeProfile(data);
			return res.respond(say.created(result, SEC_RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.secured.profile.error', error);
			next(error);
		}
	},
	async getProfiles(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			await permissions.enforceRoot(req.permissions); // we may expand this to AG admins later
			const result = await profiles.getProfiles(req.authGroup.id, req.query);
			return res.respond(say.ok(result, SEC_RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getProfile(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.user.sub) throw Boom.forbidden();
			const id = req.user.sub;
			const result = await profiles.getProfile(req.authGroup.id, id);
			return res.respond(say.ok(result, SEC_RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async deleteProfile(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.user.sub) throw Boom.forbidden();
			const id = req.user.sub;
			const result = await profiles.deleteProfile(req.authGroup.id, id);
			return res.respond(say.ok(result, SEC_RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.secured.profile.error', error);
			next(error);
		}
	},
	async patchProfile(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.user.sub) throw Boom.forbidden();
			const id = req.user.sub;
			const profile = await profiles.getProfile(req.authGroup.id, id);
			const result = await profiles.patchProfile(req.authGroup.id, profile, id, req.body, req.user.sub || 'SYSTEM ADMIN');
			return res.respond(say.ok(result, SEC_RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.secured.profile.error', error);
			next(error);
		}
	},
	/* Org Profiles */
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
			const result = await orgProfiles.writeOrgProfile(data);
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
			const result = await orgProfiles.getOrgProfiles(req.authGroup.id, req.organization.id, req.query);
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
			const result = await orgProfiles.getOrgProfile(req.authGroup.id, req.organization.id, req.params.id);
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
			const result = await orgProfiles.deleteOrgProfile(req.authGroup.id, req.organization.id, req.params.id);
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
			const profile = await orgProfiles.getOrgProfile(req.authGroup.id, req.organization.id, req.params.id);
			const result = await orgProfiles.patchOrgProfile(req.authGroup.id, req.organization.id, profile, req.params.id, req.body, req.user.sub || 'SYSTEM ADMIN');
			await tryNotification(req, result);
			return res.respond(say.ok(result, ORG_RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.organization.profile.error', error);
			next(error);
		}
	},

	/* Account Access to Org Profiles */
	async getAllMyOrgProfiles(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			const id = (req.params.id === 'me') ? req.user.sub : req.params.id;
			await permissions.enforceOwn(req.permissions, id);
			const result = await orgProfiles.getAllMyOrgProfiles(req.authGroup.id, id);
			return res.respond(say.ok(result, ORG_RESOURCE));
		} catch (error) {
			next(error);
		}
	},

	async myProfileRequest(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must specify an organization');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			if(!req.body.request) throw Boom.badData('You have not requested anything');
			if(req.body.request !== 'remove' && req.body.request !== 'remain') {
				throw Boom.badData('You can only request to remove or remain');
			}
			const id = (req.params.id === 'me') ? req.user.sub : req.params.id;
			await permissions.enforceOwn(req.permissions, id);
			const result = await orgProfiles.myProfileRequest(req.authGroup.id, req.organization.id, id, req.body.request);
			return res.respond(say.ok(result, ORG_RESOURCE));
		} catch (error) {
			next(error);
		}
	},
};

async function tryNotification(req, result) {
	try {
		if (req.globalSettings && req.globalSettings.notifications.enabled === true &&
            req.authGroup.pluginOptions.notification.enabled === true &&
            req.organization.profileNotifications === true) {
			await notifyUser(req.globalSettings, req.authGroup, req.organization.name, result.accountId, req.user.sub || 'SYSTEM ADMIN', JSON.parse(JSON.stringify(result)), req.customDomain, req.customDomainUI);
		}
	} catch (error) {
		ueEvents.emit(req.authGroup.id, 'ue.organization.profile.error', {notification: 'failed', error});
	}
}

async function notifyUser(globalSettings, authGroup, organizationName, userId, activeUser, profile, aliasDns, aliasUi) {
	const sendObject = await orgProfiles.profileUpdateNotification(authGroup, organizationName, userId, activeUser, [], profile, aliasDns, aliasUi);
	return n.notify(globalSettings, sendObject, authGroup);
}