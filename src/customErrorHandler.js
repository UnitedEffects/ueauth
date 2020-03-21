import Boom from '@hapi/boom';
import log from './api/logging/logs';
const config = require('./config');

export default {
    catch404 (req, res, next) {
        next(Boom.notFound('Resource not found.'));
    },
    async parse(error) {
        try {
            if(error.code === 11000) {
                return Boom.conflict(error.errmsg.split('E11000 duplicate key error collection: ').join(''));
            }
            const tE = await doParse(error);
            const err = tE.output.payload;
            return logger(err, tE);
        } catch (error) {
            const result = await doParse(error);
            console.error(result);
            return result.output.payload;
        }

    }
}

async function doParse(error) {
    let tE = error;
    if (!Boom.isBoom(error)) tE = Boom.boomify(error);
    if (tE.output.payload.message !== error.message) {
        tE.output.payload.message = `${tE.output.payload.message} -details: ${error.message}`;
    }
    if (tE.data) tE.output.payload.data = tE.data;
    return tE;
}

async function logger (err, tE) {
    try {
        const nE = await log.record(tE.output.payload, config.PERSIST_HTTP_ERRORS);
        err.id = nE._id || nE.id;
        if(nE.persisted === false) err.persisted = false;
        return err;
    } catch (error) {
        const result = await doParse(error);
        console.error(result);
        return result.output.payload;
    }

}