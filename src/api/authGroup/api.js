import Boom from '@hapi/boom';
import { say } from '../../say';
import group from './aGroup';
import helper from '../../helper';

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
        try {
            if (!req.body.name) return next(Boom.preconditionRequired('name is required'));
            if (req.body.prettyName) {
                if(helper.protectedNames(req.body.prettyName)) return  next(Boom.forbidden('Protected Namespace'));
            }
            const result = await group.write(req.body);
            return res.respond(say.created(result, RESOURCE));
        } catch (error) {
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
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async patch(req, res, next) {
        try {
            //todo add modifiedBy
            const result = await group.patch(req.params.id, req.body);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    }
};

export default api;