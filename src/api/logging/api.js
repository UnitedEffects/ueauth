import Boom from '@hapi/boom';
import IO from '../../io';
import logs from './logs';

const TYPE = 'LOG';

const api = {
    async writeLog(req, res, next) {
        try {
            if (!req.body.logCode) return next(Boom.preconditionRequired('logCode is required'));
            const result = await logs.writeLog(req.body);
            return IO.respond(res, IO.pCreated(result, TYPE));
        } catch (error) {
            next(error);
        }
    },
    async getLogs(req, res, next) {
        try {
            const query = req.query || {};
            const result = await logs.getLogs(query);
            return IO.respond(res, IO.pOK(result, TYPE));
        } catch (error) {
            next(error);
        }
    },
    async getLog(req, res, next) {
        try {
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await logs.getLog(req.params.id);
            return IO.respond(res, IO.pOK(result, TYPE))
        } catch (error) {
            next(error);
        }
    }
};

export default api;