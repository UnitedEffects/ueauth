import Boom from '@hapi/boom';
import { say } from '../../say';
import pins from './plugins';

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
	}
};

export default api;