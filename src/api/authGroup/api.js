import Boom from '@hapi/boom';
import { say } from '../../say';
import group from './group';
import helper from '../../helper';
import iat from '../oidc/initialAccess/iat';

const config = require('../../config');


const RESOURCE = 'Auth Group';

const api = {
    async check(req, res, next) {
        try {
            if(!req.params.prettyName) return next(Boom.preconditionRequired('Need the Pretty Name you want to check'));
            if(helper.protectedNames(req.params.prettyName)) return  res.respond(say.accepted({ available: false }, RESOURCE));
            const result = await group.check(req.params.prettyName);
            if(result === true) return res.respond(say.accepted({ available: true }, RESOURCE));
            return res.respond(say.accepted({ available: false}, RESOURCE));
        } catch (error) {
            next(error)
        }
    },
    async write(req, res, next) {
        let result;
        try {
            if (!req.body.name) return next(Boom.preconditionRequired('name is required'));
            if (req.body.prettyName) {
                if(helper.protectedNames(req.body.prettyName)) return  next(Boom.forbidden('Protected Namespace'));
            }
            //move this logic to group.js
            req.body.securityExpiration = new Date(Date.now() + (config.GROUP_SECURE_EXPIRES * 1000));
            result = JSON.parse(JSON.stringify(await group.write(req.body)));
            const expiresIn = 86400 + config.GROUP_SECURE_EXPIRES;
            const token = await iat.generateIAT(expiresIn, ['auth_group'], result);
            result.initialAccessToken = token.jti;
            if(result.config) delete result.config.keys;
            return res.respond(say.created(result, RESOURCE));
        } catch (error) {
            if (result && result.id) {
                try {
                    await group.deleteOne(result.id);
                } catch (error) {
                    console.error('Attempted and failed cleanup');
                }
            }
            next(error);
        }
    },
    async get(req, res, next) {
        try {
            const result = await group.get(req.query);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getOne(req, res, next) {
        try {
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await group.get(req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            if(result.config) delete result.config.keys;
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async patch(req, res, next) {
        try {
            //todo add modifiedBy
            const result = await group.patch(req.params.id, req.body);
            if(result.config) delete result.config.keys;
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },

    async operations(req, res, next) {
        try {
            //todo add modifiedBy
            const body = req.body;
            if(!body.operation) next(Boom.badData('must specify operation'));
            const result = await group.operations(req.authGroup.id, body.operation);
            if(result.config) delete result.config.keys;
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    }
};

export default api;