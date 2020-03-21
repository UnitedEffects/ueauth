import Boom from '@hapi/boom';
import { say } from '../../say';
import logs from './logs';

const RESOURCE = 'LOG';

const api = {
    async writeLog(req, res, next) {
        try {
            if (!req.body.message) return next(Boom.preconditionRequired('message is required'));
            const result = await logs.writeLog(req.body);
            return res.respond(say.created(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getLogs(req, res, next) {
        try {
            const result = await logs.getLogs(req.query);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getLog(req, res, next) {
        try {
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await logs.getLog(req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async patchLog(req, res, next) {
        try {
            const result = await logs.patchLog(req.params.id, req.body);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    }
};

export default api;