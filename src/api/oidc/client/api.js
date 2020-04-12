import Boom from '@hapi/boom';
import { say } from '../../../say';
import acct from './clients';

const RESOURCE = 'Clients';

const api = {
    async get(req, res, next) {
        try {
            if(!req.params.authGroup) return next(Boom.preconditionRequired('Must provide Auth Group'));
            const result = await acct.get(req.params.authGroup, req.query);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getOne(req, res, next) {
        try {
            if(!req.params.authGroup) return next(Boom.preconditionRequired('Must provide Auth Group'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await acct.getOne(req.params.authGroup, req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    }
};

export default api;