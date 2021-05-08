import Boom from '@hapi/boom';
import { say } from '../../say';
import inv from './invites';
import permissions from "../../permissions";
import acc from "../accounts/account";
import iat from "../oidc/initialAccess/iat";
import grp from '../authGroup/group';
import n from "../plugins/notifications/notifications";

const RESOURCE = 'INVITE';

const api = {
    async createInvite(req, res, next) {
        try {
            if (req.authGroup.active === false) throw Boom.forbidden('You can not transfer an inactive group');
            if (!req.body.sub) throw Boom.preconditionRequired('user/sub Id is required');
            if(!req.body.resources && req.body.resources.length === 0) throw Boom.badRequest('No resources identified');
            const account = await acc.getAccount(req.authGroup.id, req.body.sub);
            if(!account) throw Boom.notFound(req.body.sub);
            if(account.active === false || account.blocked === true) {
                throw Boom.badRequest('Intended recipient account is not in good standing');
            }
            let result = JSON.parse(JSON.stringify(await inv.createInvite(req.user.sub, req.body, req.authGroup)));
            if (req.globalSettings.notifications.enabled === true && req.authGroup.pluginOptions.notification.enabled === true) {
                try {
                    const data = inv.inviteNotificationObject(req.authGroup, account, result, [], req.user.sub);
                    await n.notify(req.globalSettings, data, req.authGroup);
                    result = await inv.incSent(req.authGroup.id, result.id);
                } catch (e) {
                    if (req.authGroup.pluginOptions.notification.ackRequiredOnOptional === true) {
                        await inv.deleteInvite(req.authGroup.id, result.id);
                        throw Boom.failedDependency('We could not complete the invitation process because notification for invites is configured as a required step and it failed. You can try again later or you can disable validation as a required step for optional notifications, of which invites is one, in your auth group settings.', e);
                    }
                    result.warning = 'WARNING: Notifications are enabled but failed for this invite. You may want to resend manually.';
                }
            }
            return res.respond(say.created(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getInvites(req, res, next) {
        try {
            if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
            if(req.permissions.enforceOwn === true) {
                if(req.query['$filter']) {
                    req.query['$filter'] = `${req.query['$filter']} and sub eq ${req.user.sub}`
                } else {
                    req.query['$filter'] = `sub eq ${req.user.sub}`
                }
            }
            const result = await inv.getInvites(req.params.group, req.query);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getInvite(req, res, next) {
        try {
            if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
            if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
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
            if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
            if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
            const result = await inv.deleteInvite(req.params.group, req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async inviteOperations(req, res, next) {
        try {
            if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
            if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
            if(!req.body.operation) throw Boom.preconditionRequired('Must provide an operation');
            const invite = await inv.getInvite(req.authGroup.id, req.params.id);
            if(!invite) throw Boom.notFound(req.params.id);
            const op = req.body.operation;
            switch (op) {
                case 'accept':
                    break;
                case 'decline':
                    break;
                case 'resend':
                    const account = await acc.getAccount(req.authGroup.id, invite.sub);
                    if(!account) throw Boom.failedDependency('Invite does not appear to be to a known user');
                    const data = inv.inviteNotificationObject(req.authGroup, account, invite, [], req.user.sub);
                    await n.notify(req.globalSettings, data, req.authGroup);
                    const result = await inv.incSent(req.authGroup.id, invite.id);
                    return res.respond(say.ok(result, RESOURCE));
                default:
                    throw Boom.badRequest(`Operation not supported: ${op}`)
            }
            throw Boom.badRequest();
        } catch (error) {
            next(error);
        }
    },
    // todo - refactor
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