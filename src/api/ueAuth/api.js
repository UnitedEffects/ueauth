import Boom from '@hapi/boom';
import auth from './auth';
import log from "../logging/logs";
const config = require('../../config');

const writeLogsToDB = false;

export default {
    async middleAny (req, res, next) {
        try {
            const roles = await auth.getRole(req.user, auth.getDomain(req));
            let resource = req.path.split('/')[1];
            if (resource === '') resource = 'root';
            let access = false;
            for (let i=0; i<roles.length; i++) {
                if (access === false){
                    access = await auth.checkRole('any', access, roles[i], req.method, resource);
                }
            }
            if (access) return next();
            return next(Boom.unauthorized())
        } catch (error) {
            log.error(error, writeLogsToDB);
            return next(Boom.unauthorized())
        }
    },
    isBearerAuthenticated: auth.isBearerAuthenticated,
    isOptionalAuthenticated: auth.isOptionalAuthenticated,
    isWebHookAuthorized (req, res, next) {
        if(req.query.code === config.UEAUTH.WEBHOOK) return next();
        return next(Boom.unauthorized())
    }
};