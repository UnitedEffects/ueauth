import Boom from '@hapi/boom';
import { say } from '../../../say';
import client from './clients';

const RESOURCE = 'Clients';

const api = {
    async get(req, res, next) {
        try {
            if(!req.params.authGroup) return next(Boom.preconditionRequired('Must provide Auth Group'));
            const result = await client.get(req.params.authGroup, req.query);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getOne(req, res, next) {
        try {
            if(!req.params.authGroup) return next(Boom.preconditionRequired('Must provide Auth Group'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await client.getOne(req.params.authGroup, req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async deleteOne(req, res, next) {
        try {
            if(!req.params.authGroup) return next(Boom.preconditionRequired('Must provide Auth Group'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            //todo check authGroup owner and req.user, must be the same
            const result = await client.deleteOne(req.params.authGroup, req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },

    async clientOperations(req, res, next) {
        try {
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            if (!req.body.operation) return res.respond(say.noContent('Client Operation'));
            switch (req.body.operation) {
                case "rotate_secret":
                    const result = await client.rotateSecret(req.params.id, req.params.authGroup);
                    if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
                    return res.respond(say.ok(result, RESOURCE));
                default:
                    throw Boom.badRequest('Unknown operation');
            }
        } catch (error) {
            next(error);
        }
    }
};

export default api;