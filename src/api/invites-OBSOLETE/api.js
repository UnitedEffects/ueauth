import Boom from '@hapi/boom';
import { say } from '../../say';
import inv from './invites';
import permissions from '../../permissions';
import acc from '../accounts/account';
import grp from '../authGroup/group';
import n from '../plugins/notifications/notifications';
import ueEvents from '../../events/ueEvents';

const RESOURCE = 'INVITE';

const api = {
	async createInvite(req, res, next) {
		try {
			if (req.authGroup.active === false) throw Boom.forbidden('You can not transfer an inactive group');
			if (!req.body.sub) throw Boom.preconditionRequired('user/sub Id is required');
			if(!req.body.resources && req.body.resources.length === 0) throw Boom.badRequest('No resources identified');
			const account = await acc.getAccount(req.authGroup.id, req.body.sub);
			if(!account) throw Boom.notFound(req.body.sub);
			if(account.active === false || account.blocked === true) {
				throw Boom.badRequest('Intended recipient account is not in good standing');
			}
			let result = JSON.parse(JSON.stringify(await inv.createInvite(req.user.sub, req.body, req.authGroup)));
			if (req.globalSettings.notifications.enabled === true && req.authGroup.pluginOptions.notification.enabled === true) {
				try {
					const data = inv.inviteNotificationObject(req.authGroup, account, result, [], req.user.sub);
					await n.notify(req.globalSettings, data, req.authGroup);
					result = await inv.incSent(req.authGroup.id, result.id);
				} catch (e) {
					if (req.authGroup.pluginOptions.notification.ackRequiredOnOptional === true) {
						await inv.deleteInvite(req.authGroup.id, result.id);
						throw Boom.failedDependency('We could not complete the invitation process because notification for invites is configured as a required step and it failed. You can try again later or you can disable validation as a required step for optional notifications, of which invites is one, in your auth group settings.', e);
					}
					result.warning = 'WARNING: Notifications are enabled but failed for this invite. You may want to resend manually.';
				}
			}
			return res.respond(say.created(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.invite.error', error);
			next(error);
		}
	},
	async getInvites(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(req.permissions.enforceOwn === true) {
				if(req.query['$filter']) {
					req.query['$filter'] = `${req.query['$filter']} and sub eq ${req.user.sub}`;
				} else {
					req.query['$filter'] = `sub eq ${req.user.sub}`;
				}
				req.query['$filter'] = `${req.query['$filter']} and status ne 'declined' and status ne 'accepted'`;
			}
			const result = await inv.getInvites(req.params.group, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getInvite(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			const result = await inv.getInvite(req.params.group, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			await permissions.enforceOwn(req.permissions, result.sub);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async deleteInvite(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			const result = await inv.deleteInvite(req.params.group, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.invite.error', error);
			next(error);
		}
	},
	async inviteOperations(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			if(!req.body.operation) throw Boom.preconditionRequired('Must provide an operation');
			const invite = await inv.getInvite(req.authGroup.id, req.params.id);
			if(!invite) throw Boom.notFound(req.params.id);
			const op = req.body.operation;
			const valEr = [];
			switch (op) {
			case 'accept':
				if (req.user.sub !== invite.sub) throw Boom.unauthorized();
				if (req.authGroup.id !== invite.authGroup) throw Boom.unauthorized();
				if (invite.status === 'accepted') throw Boom.badRequest('This was already accepted');
				await Promise.all(invite.resources.map(async (r) => {
					switch (r.resourceType) {
					case 'group':
						const ogOwner = req.authGroup.owner;
						const ogStatus = invite.status;
						try {
							await grp.partialUpdate(invite.authGroup, { owner: invite.sub });
							await inv.updateInviteStatus(invite.authGroup, invite.id, 'accepted');
						} catch (e) {
							await grp.partialUpdate(invite.authGroup, { owner: ogOwner });
							await inv.updateInviteStatus(invite.authGroup, invite.id, ogStatus);
							console.error(e);
							valEr.push(e.message);
						}
						break;
					default:
						valEr.push('Unknown resource type');
					}
				}));
				if (valEr.length !== 0) throw Boom.failedDependency(valEr.join('; '));
				ueEvents.emit(invite.authGroup, 'ue.invite.accepted', invite);
				return res.respond(say.noContent(RESOURCE));
			case 'decline':
				if (req.user.sub !== invite.sub) throw Boom.unauthorized();
				if (req.authGroup.id !== invite.authGroup) throw Boom.unauthorized();
				if (invite.status === 'accepted') throw Boom.badRequest('This was already accepted');
				await Promise.all(invite.resources.map(async (r) => {
					switch (r.resourceType) {
					case 'group':
						const ogStatus = invite.status;
						try {
							await inv.updateInviteStatus(invite.authGroup, invite.id, 'declined');
						} catch (e) {
							await inv.updateInviteStatus(invite.authGroup, invite.id, ogStatus);
							console.error(e);
							valEr.push(e.message);
						}
						break;
					default:
						valEr.push('Unknown resource type');
					}
				}));
				if (valEr.length !== 0) throw Boom.failedDependency(valEr.join('; '));
				ueEvents.emit(invite.authGroup, 'ue.invite.declined', invite);
				return res.respond(say.noContent(RESOURCE));
			case 'resend':
				if (req.user.sub !== invite.sub) throw Boom.unauthorized();
				if (req.authGroup.id !== invite.authGroup) throw Boom.unauthorized();
				if (invite.status === 'accepted') throw Boom.badRequest('This was already accepted');
				const account = await acc.getAccount(req.authGroup.id, invite.sub);
				if(!account) throw Boom.failedDependency('Invite does not appear to be to a known user');
				const data = inv.inviteNotificationObject(req.authGroup, account, invite, [], req.user.sub);
				await n.notify(req.globalSettings, data, req.authGroup);
				const result = await inv.incSent(req.authGroup.id, invite.id);
				ueEvents.emit(invite.authGroup, 'ue.invite.resent', invite);
				return res.respond(say.ok(result, RESOURCE));
			default:
				throw Boom.badRequest(`Operation not supported: ${op}`);
			}
			throw Boom.badRequest();
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.invite.error', error);
			next(error);
		}
	}
};

export default api;