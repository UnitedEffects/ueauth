import Boom from '@hapi/boom';
import { say } from '../../say';
import pins from './plugins';
import notifications from './notifications/notifications';
import permissions from '../../permissions';
import ueEvents from '../../events/ueEvents';
import account from '../accounts/account';

const config = require('../../config');

const RESOURCE = 'PLUGINS';
const RESOURCE_NOTIFICATION = 'NOTIFICATION';

const api = {
	async toggleGlobalNotifications(req, res, next) {
		try {
			if (!req.body) return next(Boom.preconditionRequired('configuration body is required'));
			if (req.body.enabled === true && !req.body.notificationServiceUri) {
				return next(Boom.preconditionRequired('notification service url is required'));
			}
			await permissions.enforceRoot(req.permissions);
			const user = req.user.sub;
			const result = await pins.toggleGlobalNotifications(req.body, user, req.authGroup);
			return res.respond(say.created(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async toggleGlobalMFASettings(req, res, next) {
		try {
			if (!req.body) return next(Boom.preconditionRequired('configuration body is required'));
			if (req.body.enabled === true && !req.body.type) {
				return next(Boom.preconditionRequired('Type is required'));
			}
			await permissions.enforceRoot(req.permissions);
			const user = req.user.sub;
			const result = await pins.toggleGlobalMFASettings(req.body, user, req.authGroup);
			return res.respond(say.created(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getLatestPluginOptions(req, res, next) {
		try {
			const result = await pins.getLatestPluginOptions();
			await permissions.enforceRoot(req.permissions);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async auditPluginOptions(req, res, next) {
		try {
			const result = await pins.auditPluginOptions();
			await permissions.enforceRoot(req.permissions);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	// Notifications
	async writeNotification(req, res, next) {
		let result;
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(req.body && !req.body.recipientUserId && !req.body.recipientEmail) {
				throw Boom.preconditionRequired('You must provide either a recipientUserId or recipientEmail');
			}
			if(req.body.recipientUserId) {
				const user = await account.getAccount(req.authGroup.id, req.body.recipientUserId);
				if(!user) throw Boom.notFound('User Id not valid');
				if(!req.body.recipientEmail) {
					req.body.recipientEmail = user.email;
				}
			}
			const data = req.body;
			data.authGroupId = req.authGroup.id;
			data.createdBy = req.user.sub;
			data.iss = `${config.PROTOCOL}://${req.customDomain || config.SWAGGER}/${req.authGroup.id}`;
			data.destinationUri = req.globalSettings.notifications.notificationServiceUri;
			if(req.organization || req.permissions.orgContext) {
				data.organization = (req.organization) ? req.organization.id : req.permissions.orgContext;
			}
			if(!data.formats) {
				data.formats = [];
				if(data.recipientEmail) data.formats.push('email');
				if(data.recipientSms) data.formats.push('sms');
			}
			data.branding = {
				platform: req.authGroup.name,
				contact: req.authGroup.primaryEmail,
				domain: req.authGroup.primaryDomain,
				tos: req.authGroup.primaryTOS,
				privacyPolicy: req.authGroup.primaryPrivacyPolicy,
				backgroundImage: req.authGroup.config?.ui?.skin?.splashImage,
				logo: req.authGroup.config?.ui?.skin?.logo
			};
			result = await notifications.createNotification(data);
			try {
				await notifications.sendNotification(result, req.globalSettings);
				result.processed = true;
			} catch (e) {
				if(data.type !== 'general') throw e;
				if(data.type === 'general' && req.authGroup.pluginOptions.notification.ackRequiredOnOptional === true) {
					throw e;
				}
				console.error(`General Notifications do not require success for this authGroup: ${req.authGroup.id}`);
				console.error(e.message);
			}
			return res.respond(say.created(result, RESOURCE_NOTIFICATION));
		} catch (error) {
			if (error.isAxiosError) {
				await notifications.deleteNotification(req.authGroup, result.id);
				const newError = Boom.failedDependency(`The notification plugin service did not process the request for notification: ${result.id}`);
				ueEvents.emit(req.authGroup.id, 'ue.plugin.notification.error', newError);
				return next(newError);
			}
			ueEvents.emit(req.authGroup.id, 'ue.plugin.notification.error', error);
			return next(error);
		}
	},
	async getNotifications(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(req.organization || req.permissions.orgContext) {
				req.query.organization = (req.organization) ? req.organization.id : req.permissions.orgContext;
			}
			const includeUser = (req.permissions.enforceOwn === true) ? req.user.sub : undefined;
			const result = await notifications.getNotifications(req.authGroup, req.query, includeUser);
			return res.respond(say.ok(result, RESOURCE_NOTIFICATION));
		} catch (error) {
			next(error);
		}
	},
	async getNotification(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			let org;
			if(req.organization || req.permissions.orgContext) {
				org = (req.organization) ? req.organization.id : req.permissions.orgContext;
			}
			const result = await notifications.getNotification(req.authGroup, req.params.id, org);
			await permissions.enforceOwn(req.permissions, result.createdBy);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE_NOTIFICATION));
		} catch (error) {
			next(error);
		}
	},
	async deleteNotification(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			let org;
			if(req.organization || req.permissions.orgContext) {
				org = (req.organization) ? req.organization.id : req.permissions.orgContext;
			}
			const includeUser = (req.permissions.enforceOwn === true) ? req.user.sub : undefined;
			const result = await notifications.deleteNotification(req.authGroup, req.params.id, includeUser, org);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE_NOTIFICATION));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.plugin.notification.error', error);
			next(error);
		}
	},
	// Account Notification Queries
	async getMyNotifications(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			const result = await notifications.getMyNotifications(req.authGroup, req.user.sub);
			return res.respond(say.ok(result, RESOURCE_NOTIFICATION));
		} catch (error) {
			next(error);
		}
	},
	async getMyNotification(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			const result = await notifications.getMyNotification(req.authGroup, req.user.sub, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE_NOTIFICATION));
		} catch (error) {
			next(error);
		}
	},
	// Notification Processing
	async processNotification(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			if(req.permissions.enforceOwn === true) throw Boom.unauthorized();
			const result = await notifications.processNotification(req.globalSettings, req.authGroup, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE_NOTIFICATION));
		}catch (error) {
			if (error.isAxiosError) {
				const newError = Boom.failedDependency(`The notification plugin service did not process this request for notification: ${req.params.id}`);
				ueEvents.emit(req.authGroup.id, 'ue.plugin.notification.error', newError);
				return next(newError);
			}
			ueEvents.emit(req.authGroup.id, 'ue.plugin.notification.error', error);
			return next(error);
		}
	},
	async bulkNotificationProcess(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(req.permissions.enforceOwn === true) throw Boom.unauthorized();
			const result = await notifications.bulkNotificationProcess(req.globalSettings, req.authGroup.id);
			const out = {
				message: 'Request received and processing attempted. Validate processed property on each result. This API returns 200 upon completion of the task regardless of outcome for each result',
				result
			};
			return res.respond(say.ok(out, RESOURCE_NOTIFICATION));
		}catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.plugin.notification.error', error);
			next(error);
		}
	}
};

export default api;