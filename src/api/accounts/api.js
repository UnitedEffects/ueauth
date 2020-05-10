import Boom from '@hapi/boom';
import { say } from '../../say';
import acct from './account';
import group from '../authGroup/aGroup';

const RESOURCE = 'Account';

const api = {
    async writeAccount(req, res, next) {
        try {
            if (req.groupActivationEvent === true) return api.activateGroupWithAccount(req, res, next);
            if (req.authGroup.active === false) return next(Boom.forbidden('You can not add members to an inactive group'));
            if (!req.body.email) return next(Boom.preconditionRequired('username is required'));
            if (!req.body.password) return next(Boom.preconditionRequired('password is required'));
            const result = await acct.writeAccount(req.body);
            return res.respond(say.created(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async activateGroupWithAccount(req, res, next) {
        let account;
        try {
            if (!req.body.email) return next(Boom.preconditionRequired('username is required'));
            if (!req.body.password) return next(Boom.preconditionRequired('password is required'));
            account = await acct.writeAccount(req.body);
            const group = await group.activateNewAuthGroup(req.authGroup, account);
            const out = {
                account,
                authGroup: group
            };
            return res.respond(say.created(out, RESOURCE));
        } catch (error) {
            if (account) {
                try {
                    await acct.deleteAccount(req.authGroup, account._id);
                } catch (error) {
                    console.info('There was a problem and you may need the admin to finish setup');
                }
            }
            next(error);
        }
    },
    async getAccounts(req, res, next) {
        try {
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
            const result = await acct.getAccounts(req.params.group, req.query);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getAccount(req, res, next) {
        try {
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await acct.getAccount(req.params.group, req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async patchAccount(req, res, next) {
        try {
            //todo add modifiedBy
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await acct.patchAccount(req.params.group, req.params.id, req.body);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async deleteAccount(req, res, next) {
        try {
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await acct.deleteAccount(req.params.group, req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
};

export default api;