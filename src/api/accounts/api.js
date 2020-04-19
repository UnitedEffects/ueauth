import Boom from '@hapi/boom';
import { say } from '../../say';
import acct from './account';

const RESOURCE = 'Account';

const api = {
    async writeAccount(req, res, next) {
        try {
            if (!req.body.email) return next(Boom.preconditionRequired('username is required'));
            if (!req.body.password) return next(Boom.preconditionRequired('password is required'));
            const result = await acct.writeAccount(req.body);
            return res.respond(say.created(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getAccounts(req, res, next) {
        try {
            if(!req.params.authGroup) return next(Boom.preconditionRequired('Must provide authGroup'));
            const result = await acct.getAccounts(req.params.authGroup, req.query);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getAccount(req, res, next) {
        try {
            if(!req.params.authGroup) return next(Boom.preconditionRequired('Must provide authGroup'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await acct.getAccount(req.params.authGroup, req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async patchAccount(req, res, next) {
        try {
            //todo add modifiedBy
            if(!req.params.authGroup) return next(Boom.preconditionRequired('Must provide authGroup'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await acct.patchAccount(req.params.authGroup, req.params.id, req.body);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    }
};

export default api;