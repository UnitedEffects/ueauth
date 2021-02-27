import Boom from '@hapi/boom';
import { say } from '../../say';
import notify from './plugins';

const RESOURCE = 'LOG';

const api = {
    async toggleNotifications(req, res, next) {
        try {
            if (!req.body) return next(Boom.preconditionRequired('configuration body is required'));
            const result = await notify.toggleNotifications(req.body, req.user.sub);
            return res.respond(say.created(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
/*
    // todo - create
    async getPluginHistory(req, res, next) {
        try {
            const result = await notify.getLogs(req.query);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    // todo - create
    async getLatest(req, res, next) {
        try {
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await notify.getLog(req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    }

 */
};

export default api;