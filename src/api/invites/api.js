import Boom from '@hapi/boom';
import { say } from '../../say';
import inv from './invites';
import permissions from "../../permissions";
import acc from "../accounts/account";
import iat from "../oidc/initialAccess/iat";
import grp from '../authGroup/group';

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
    async accept(req, res, next) {
        try {
            /**
             * normal member access token required to get here
             * only doing group for now
             * body includes - passCode, accessToken
             * validate accessToken via IAT Lookup
             * look up invite for sub/group/type
             * validate passCode
             * validate accessToken
             * if all good, update group with new owner=sub
             */
            const user = req.user;
            const inviteType = req.params.inviteType.toLowerCase();
            if(!req.body.inviteToken) throw Boom.badRequest('invite token is required');
            const iaTok = req.body.inviteToken;
            console.info(user);
            switch (inviteType) {
                case 'group':
                    console.info('group');
                    if(!req.body.passCode) throw Boom.badRequest('for group transfer, pass code is required');
                    const pc = req.body.passCode;
                    const access = await iat.getOne(iaTok, req.authGroup.id);
                    if(!access) throw Boom.unauthorized();
                    const payload = JSON.parse(JSON.stringify(access.payload));
                    if(payload.email === undefined) throw Boom.unauthorized();
                    if(payload.sub === undefined) throw Boom.unauthorized();
                    if(payload.email !== req.user.email) throw Boom.unauthorized();
                    if(payload.sub !== req.user.sub) throw Boom.unauthorized();
                    const invitation = await inv.inviteAuthorizedLookup(req.authGroup.id, req.user.sub, 'group');
                    if(!invitation) {
                        console.error('Invite not found');
                        throw Boom.unauthorized();
                    }
                    if(!invitation.verifyPassCode(pc)) {
                        console.error('Passcode is wrong');
                        throw Boom.unauthorized();
                    }
                    if(!invitation.verifyAccessToken(iaTok)) {
                        console.error('IAT is wrong');
                        throw Boom.unauthorized();
                    }
                    const updatedGroup = await grp.switchGroupOwner(req.authGroup, req.user.sub);
                    const output = {
                        message: 'ownership changed',
                        warning: null,
                        group: updatedGroup
                    }
                    try {
                        await iat.deleteOne(access._id, req.authGroup.id);
                        await inv.deleteInvite(req.authGroup.id, invitation.id);
                    } catch (error) {
                        console.error(error);
                        output.warning = 'There was an issue removing the invitation but ownership is transferred. It will expire on its own or you can manually delete it as the new owner.'
                    }
                    console.info(output);
                    return res.respond(say.ok(output, RESOURCE));
                default:
                    throw Boom.notFound('Unknown Invite Type');
            }
        } catch (error) {
            next(error);
        }
    }
};

export default api;