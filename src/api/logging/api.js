import Boom from '@hapi/boom';
import { say } from '../../say';
import logs from './logs';

const TYPE = 'LOG';

const api = {
    async writeLog(req, res, next) {
        try {
            if (!req.body.logCode) return next(Boom.preconditionRequired('logCode is required'));
            const result = await logs.writeLog(req.body);
            return res.respond(say.created(result, TYPE));
        } catch (error) {
            next(error);
        }
    },
    async getLogs(req, res, next) {
        try {
            const query = req.query || {};
            const result = await logs.getLogs(query);
            return res.respond(say.ok(result, TYPE));
        } catch (error) {
            next(error);
        }
    },
    async getLog(req, res, next) {
        try {
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await logs.getLog(req.params.id);
            return res.respond(say.ok(result, TYPE));
        } catch (error) {
            next(error);
        }
    }
};

export default api;