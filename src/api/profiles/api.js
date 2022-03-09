import Boom from '@hapi/boom';
import acc from '../accounts/account';
import permissions from '../../permissions';
import org from '../orgs/orgs';
import orgProfiles from './profiles/org';
import profiles from './profiles/profile';
import requests from './profiles/request';
import views from './profiles/view';
import snaps from './profiles/snap';
import ueEvents from '../../events/ueEvents';
import {say} from '../../say';
import n from '../plugins/notifications/notifications';
import challenge from '../plugins/challenge/challenge';

const ORG_RESOURCE = 'Organization User Profile';
const SEC_RESOURCE = 'Secured Profile';
const config = require('../../config');

export default {
	/* Snapshot */
	async querySnapShot(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide request id');
			if(!req.user.sub) throw Boom.forbidden();
			const caller = req.user.sub;
			const result = await snaps.getSnapShot(req.authGroup.id, req.params.id, caller);
			if(!result) throw Boom.notFound();
			return res.respond(say.ok(result, SEC_RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async killSnapShot(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide request id');
			if(!req.user.sub) throw Boom.forbidden();
			const caller = req.user.sub;
			const result = await snaps.deleteSnapShot(req.authGroup.id, req.params.id, caller);
			if(!result) throw Boom.notFound();
			return res.respond(say.ok(result, SEC_RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	/* View Access API */
	async getAllViews(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.user.sub) throw Boom.forbidden();
			if(!req.params.gor) throw Boom.badRequest('Must specify sent or received');
			let result;
			switch(req.params.gor.toLowerCase()) {
			case 'given':
				result = await views.getAllViews(req.authGroup.id, req.query, req.user.sub);
				break;
			case 'received':
				result = await views.getAllViews(req.authGroup.id, req.query, undefined, req.user.sub);
				break;
			default:
				throw Boom.badRequest('unknown request');
			}
			return res.respond(say.ok(result, SEC_RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getView(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide request id');
			if(!req.user.sub) throw Boom.forbidden();
			const user = req.user.sub;
			const result = await views.getView(req.authGroup.id, req.params.id, user);
			if(!result) throw Boom.notFound();
			return res.respond(say.ok(result, SEC_RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async deleteView(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide request id');
			if(!req.user.sub) throw Boom.forbidden();
			const user = req.user.sub;
			const result = await views.deleteView(req.authGroup.id, req.params.id, user);
			if(!result) throw Boom.notFound();
			return res.respond(say.ok(result, SEC_RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.secured.profile.error', error);
			next(error);
		}
	},
	/* Request API */
	async createRequest(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.user.sub) throw Boom.forbidden();
			const requestingAccountId = req.user.sub;
			if(!req.params['account_id']) throw Boom.badRequest('Must target an account for the request');
			const data = JSON.parse(JSON.stringify(req.body));
			data.authGroup = req.authGroup.id;
			data.targetAccountId = req.params['account_id'];
			data.requestingAccountId = requestingAccountId;
			const target = await acc.getAccount(req.authGroup.id, data.targetAccountId);
			if(!target) throw Boom.notFound(`target: ${data.targetAccountId}`);
			if(target.acceptingProfileRequests === false) throw Boom.locked('User not accepting requests');
			const sender = await acc.getAccount(req.authGroup.id, requestingAccountId);
			data.requestingEmail = sender.email;
			if(data.type === 'access' && !data.accessExpirationTime) {
				data.accessExpirationTime = 'unlimited';
			}
			if(data.type === 'sync' && !data.orgId) {
				throw Boom.preconditionRequired('You must specify an organization to sync with');
			}
			if(data.type === 'copy' && data.dataCallback) {
				if(!data.dataCallback.includes('https')) throw Boom.badRequest('Callbacks must be https');
			}
			let organization;
			if(data.orgId) {
				organization = await org.getOrg(req.authGroup.id, data.orgId);
				if(!organization) throw Boom.badRequest('Unknown Organization ID requested for sync');
			}
			const result = await requests.createRequest(data);
			try {
				if(req.globalSettings?.mfaChallenge?.enabled === true) {
					if(target.mfa?.enabled === true && target.myNotifications?.profileRequests !== false) {
						const ag = JSON.parse(JSON.stringify(req.authGroup));
						const uid = result.id;
						const meta = {
							event: 'ue.secured.profile.access.requested',
							content: {
								title: 'Personal Profile Data Request',
								header: `${ag.name} Profile Requested`,
								body: await reqChallengeMessge(ag, sender, data, organization?.name)
							}
						};
						console.info('UID SHOULD BE REQUEST ID');
						console.info(uid);
						await challenge.sendChallenge(ag, req.globalSettings, {
							accountId: data.targetAccountId, mfaEnabled: true }, uid, meta);
					}
				}
			} catch (error) {
				console.error('UNABLE TO SEND DEVICE CHALLENGE');
				console.error(error);
			}
			return res.respond(say.created(result, SEC_RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.secured.profile.error', error);
			next(error);
		}
	},
	async getRequests(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.user.sub) throw Boom.forbidden();
			if(!req.params.sor) throw Boom.badRequest('Must specify sent or received');
			let result;
			switch(req.params.sor.toLowerCase()) {
			case 'sent':
				result = await requests.getMyRequests(req.authGroup.id, req.query, undefined, req.user.sub);
				break;
			case 'received':
				result = await requests.getMyRequests(req.authGroup.id, req.query, req.user.sub);
				break;
			default:
				throw Boom.badRequest('unknown request');
			}
			return res.respond(say.ok(result, SEC_RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getRequest(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide request id');
			if(!req.user.sub) throw Boom.forbidden();
			const user = req.user.sub;
			const result = await requests.getRequest(req.authGroup.id, req.params.id, user);
			if(!result) throw Boom.notFound();
			return res.respond(say.ok(result, SEC_RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async deleteRequest(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide request id');
			if(!req.user.sub) throw Boom.forbidden();
			const user = req.user.sub;
			const result = await requests.deleteRequest(req.authGroup.id, req.params.id, user);
			if(!result) throw Boom.notFound();
			return res.respond(say.ok(result, SEC_RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.secured.profile.error', error);
			next(error);
		}
	},
	async updateRequestStatus(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide request id');
			if(!req.user.sub) throw Boom.forbidden();
			if(!req.body.action) throw Boom.preconditionRequired('Must specify an action');
			if (req.body.action !== 'approved' && req.body.action !== 'denied') throw Boom.badRequest('unknown action');
			const user = req.user.sub;
			const result = await requests.updateRequestStatus(req.authGroup.id, req.params.id, req.body.action, user);
			if(!result) throw Boom.notFound();
			return res.respond(say.ok(result, SEC_RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.secured.profile.error', error);
			next(error);
		}
	},
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
			if(!result) throw Boom.notFound();
			return res.respond(say.ok(result, SEC_RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getProfileById(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must specify an AuthGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must specify an id');
			if(!req.user.sub) throw Boom.forbidden();
			const id = req.params.id;
			if(id !== req.user.sub) {
				const check = await views.checkView(req.authGroup.id, id, req.user.sub);
				if(!check) throw Boom.forbidden();
			}
			const result = await profiles.getProfile(req.authGroup.id, id);
			if(!result) throw Boom.notFound(id);
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
			if(!result) throw Boom.notFound();
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
			if(!result) throw Boom.notFound();
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
			if(!result) throw Boom.notFound();
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
			if(!result) throw Boom.notFound();
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
			if(!result) throw Boom.notFound();
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

async function reqChallengeMessge(ag, sender, data, orgName) {
	let message = `Someone with email address ${sender.email} and account ID ${sender.id} has requested access to your secured profile. By approving the request, you are taking responsibility for data share or transmission with the requesting party and release ${ag.name} and ${config.ROOT_COMPANY_NAME} from all liability for the decision.`;
	switch (data.type) {
	case 'sync':
		message = `${message} This a sync request: ${orgName || 'an organization'} will take a snapshot of your secured profile to populate their records as of today and hold that data at their discretion. Once synced, this data belongs to ${orgName || 'the organization'} and ${ag.name} platform can communicate requests for deletion but cannot guarantee compliance.`;
		break;
	case 'access':
		message = `${message} This an access request, which means someone is trying to directly view your secured profile. The request specifies the access expiration as ${data.accessExpirationTime} days.`;
		break;
	case 'copy':
		message = `${message} This a copy request, which means that your data could end up being copied to a system or product outside the control of ${ag.name} platform or its partners and subsidiaries.`;
		if(data.dataCallback) {
			message = `${message} The request has been set up to transmit your data to an external server: ${data.dataCallback.replace('https://', '').split('/')[0]}.`;
		}
		break;
	default:
		break;
	}
	message = `${message}  Please proceed carefully and ensure you know the requesting party before approving.`;
	if(data.requestDetails) message = `${message} Details Provided: ${data.requestDetails}`;
	return message;
}