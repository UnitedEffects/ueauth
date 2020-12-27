import Boom from '@hapi/boom';
import { say } from '../../say';
import inv from './invites';
import permissions from "../../permissions";
import acc from "../accounts/account";

const RESOURCE = 'Account';

const api = {
    async createInvite(req, res, next) {
        try {
            if (req.authGroup.active === false) throw Boom.forbidden('You can not transfer an inactive group');
            if (!req.body.sub) throw Boom.preconditionRequired('user/sub Id is required');
            if (req.body.type === 'group' && !req.body.passCode) throw Boom.preconditionRequired('a passCode is required for group ownership transfer invites');
            const account = await acc.getAccount(req.authGroup.id, req.body.sub);
            if(!account) throw Boom.notFound(req.body.sub);
            if(account.active === false || account.blocked === true) {
                throw Boom.badRequest('Intended recipient account is not in good standing');
            }
            req.body.email = account.email;
            if(account.txt) req.body.txt = account.txt;
            const result = await inv.createInvite(req.body, req.authGroup);
            return res.respond(say.created(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getInvites(req, res, next) {
        try {
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
            const result = await inv.getInvites(req.params.group, req.query);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getInvite(req, res, next) {
        try {
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await inv.getInvite(req.params.group, req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            await permissions.enforceOwn(req.permissions, result.sub);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async deleteInvite(req, res, next) {
        try {
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await inv.deleteInvite(req.params.group, req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
};

export default api;