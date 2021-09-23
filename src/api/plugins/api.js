import Boom from '@hapi/boom';
import { say } from '../../say';
import pins from './plugins';
import notifications from './notifications/notifications';
import permissions from "../../permissions";
import ueEvents from "../../events/ueEvents";

const config = require('../../config');

const RESOURCE = 'PLUGINS';

const api = {
	async toggleGlobalNotifications(req, res, next) {
		try {
			if (!req.body) return next(Boom.preconditionRequired('configuration body is required'));
			if (req.body.enabled === true && !req.body.notificationServiceUri) {
				return next(Boom.preconditionRequired('notification service url is required'));
			}
			const user = req.user.sub;
			const result = await pins.toggleGlobalNotifications(req.body, user, req.authGroup);
			return res.respond(say.created(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getLatestPluginOptions(req, res, next) {
		try {
			const result = await pins.getLatestPluginOptions();
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async auditPluginOptions(req, res, next) {
		try {
			const result = await pins.auditPluginOptions();
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async writeNotification(req, res, next) {
		let result;
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			const data = req.body;
			data.authGroupId = req.authGroup.id;
			data.createdBy = req.user.sub;
			data.iss = `${config.PROTOCOL}://${config.SWAGGER}/${req.authGroup.id}`;
			data.destinationUri = req.globalSettings.notifications.notificationServiceUri;
			if(!data.formats) {
				data.formats = [];
				if(data.recipientEmail) data.formats.push('email');
				if(data.recipientSms) data.formats.push('sms');
			}
			result = await notifications.createNotification(data);
			try {
				await notifications.sendNotification(result, req.globalSettings);
				result.processed = true;
			} catch (e) {
				if(data.type !== 'general') throw e;
				if(data.type === 'general' && req.authGroup.pluginOptions.notification.ackRequiredOnOptional === true) {
					throw e;
				}
				console.error(`Invites do not require successful notification for this authGroup: ${req.authGroup.id}`);
				console.error(e.message);
			}
			return res.respond(say.created(result, RESOURCE));
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
			const result = await notifications.getNotifications(req.authGroup, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getNotification(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			await permissions.enforceOwn(req.permissions, req.params.id);
			const result = await notifications.getNotification(req.authGroup, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async deleteNotification(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			await permissions.enforceOwn(req.permissions, req.params.id);
			const result = await notifications.deleteNotification(req.authGroup, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.plugin.notification.error', error);
			next(error);
		}
	},
	async processNotification(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			await permissions.enforceOwn(req.permissions, req.params.id);
			const result = await notifications.processNotification(req.globalSettings, req.authGroup, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE));
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
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			const result = await notifications.bulkNotificationProcess(req.globalSettings, req.authGroup.id);
			const out = {
				message: 'Request received and processing attempted. Validate processed property on each result. This API returns 200 upon completion of the task regardless of outcome for each result',
				result
			};
			return res.respond(say.ok(out, RESOURCE));
		}catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.plugin.notification.error', error);
			next(error);
		}
	}
};

export default api;