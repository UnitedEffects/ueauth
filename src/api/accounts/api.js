import Boom from '@hapi/boom';
import { say } from '../../say';
import acct from './account';

const RESOURCE = 'Account';

const api = {
    async writeAccount(req, res, next) {
        try {
            if (!req.body.username) return next(Boom.preconditionRequired('username is required'));
            if (!req.body.password) return next(Boom.preconditionRequired('password is required'));
            const result = await acct.writeAccount(req.body);
            return res.respond(say.created(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getAccounts(req, res, next) {
        try {
            const result = await acct.getAccounts(req.query);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getAccount(req, res, next) {
        try {
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await acct.getAccount(req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async patchAccount(req, res, next) {
        try {
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await acct.patchAccount(req.params.id, req.body);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    }
};

export default api;