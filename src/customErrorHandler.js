import Boom from '@hapi/boom';
import log from './api/logging/logs';
const config = require('./config');

export default {
    catch404 (req, res, next) {
        next(Boom.notFound('Resource not found.'));
    },
    async parse(error) {
        if(error.code === 11000) {
            return Boom.conflict(error.errmsg.split('E11000 duplicate key error collection: ').join(''));
        }
        if (!Boom.isBoom(error)) return Boom.boomify(error);
        const err = error.output.payload;
        const nE = await log.record(error.output.payload, config.PERSIST_HTTP_ERRORS);
        err.id = nE._id;
        return err;
    }
}