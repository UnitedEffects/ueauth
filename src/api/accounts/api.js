import Boom from '@hapi/boom';
import { say } from '../../say';
import acct from './account';
import group from '../authGroup/group';
import iat from '../oidc/initialAccess/iat';
import cl from "../oidc/client/clients";
import permissions from "../../permissions";
import n from '../plugins/notifications/notifications';
import session from '../oidc/session/session';

const config = require('../../config');

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
        let client;
        try {
            account = await acct.writeAccount(req.body);
            if(!account) throw Boom.expectationFailed('Account not created due to unknown error. Try again later');
            client = await cl.generateClient(req.authGroup);
            if(!client) throw Boom.expectationFailed('Auth Group Client Not Created! Rolling back.');
            let g = await group.activateNewAuthGroup(req.authGroup, account, client.client_id);
            if(!g) throw Boom.expectationFailed('Auth Group Not Activated! Rolling back.');
            g = JSON.parse(JSON.stringify(g));
            if(g.config) delete g.config.keys;
            const out = {
                account,
                authGroup: g,
                client
            };
            try {
                await iat.deleteOne(req.authInfo.token._id, req.authGroup._id);
            } catch (error) {
                console.error('could not clean token');
            }
            return res.respond(say.created(out, RESOURCE));
        } catch (error) {
            if (account) {
                try {
                    const aDone = await acct.deleteAccount(req.authGroup, account._id);
                    if(!aDone) throw new Error('Account delete not complete');
                } catch (error) {
                    console.error(error);
                    console.info('Account Rollback: There was a problem and you may need the admin to finish setup');
                }
            }
            if (client) {
                try {
                    const cDone = await client.deleteOne(req.authGroup, client.client_id);
                    if(!cDone) throw new Error('Client delete not complete');
                } catch (error) {
                    console.error(error);
                    console.info('Client Rollback: There was a problem and you may need the admin to finish setup');
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
            await permissions.enforceOwn(req.permissions, req.params.id);
            const result = await acct.getAccount(req.params.group, req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async patchAccount(req, res, next) {
        try {
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            if(req.user && req.user.decoded && req.user.decoded.kind === 'InitialAccessToken') {
                if (req.body) {
                    if(req.body.length > 1 || req.body[0].path !== '/password' || req.body[0].op !== 'replace') {
                        throw Boom.methodNotAllowed();
                    }
                }
            }
            await permissions.enforceOwn(req.permissions, req.params.id);
            const result = await acct.patchAccount(req.params.group, req.params.id, req.body, req.user.sub || req.user.id || 'SYSTEM');
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async deleteAccount(req, res, next) {
        try {
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            await permissions.enforceOwn(req.permissions, req.params.id);
            if(req.authGroup.owner === req.params.id) return next(Boom.badRequest('You can not delete the owner of the auth group'));
            const result = await acct.deleteAccount(req.params.group, req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },

    async resetPassword(req, res, next) {
        let result;
        let iAccessToken;
        try {
            if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
            if(!req.body.email) throw Boom.preconditionRequired('Must provide email address');
            if(req.globalSettings.notifications.enabled === false) throw Boom.methodNotAllowed('There is no Global Notification Plugin enabled. You will need the admin to reset your password directly and inform you of the new password');
            if(req.authGroup.pluginOptions.notification.enabled === false) throw Boom.methodNotAllowed('Your admin has not enabled notifications. You will need the admin to reset your password directly and inform you of the new password');
            const user = await acct.getAccountByEmailOrUsername(req.authGroup.id, req.body.email, req.authGroup.config.requireVerified);
            if(!user) throw Boom.notFound('This email address is not registered with our system');
            const meta = {
                auth_group: req.authGroup.id,
                sub: user.id,
                email: user.email
            };
            iAccessToken = await iat.generateIAT(14400, ['auth_group'], req.authGroup, meta);

            const data = {
                iss: `${config.PROTOCOL}://${config.SWAGGER}/${req.authGroup.id}`,
                createdBy: `proxy_${user.id}`,
                type: 'forgotPassword',
                formats: req.body.formats,
                recipientUserId: user.id,
                recipientEmail: user.email,
                recipientSms: user.sms,
                screenUrl: `${config.PROTOCOL}://${config.SWAGGER}/${req.authGroup.id}/forgot-password`,
                subject: `${req.authGroup.prettyName} - User Password Reset`,
                message: 'You have requested a password reset. Click the button below or copy past the link in a browser to continue.',
                meta: {
                    token: iAccessToken.jti,
                    apiHeader: `bearer ${iAccessToken.jti}`,
                    apiUri: `${config.PROTOCOL}://${config.SWAGGER}/api/${req.authGroup.id}/user/${user.id}`,
                    apiMethod: 'PATCH',
                    apiBody: [
                        {
                            "op": "replace",
                            "path": "/password",
                            "value": 'NEW-PASSWORD-HERE'
                        }
                    ]
                }
            }
            if(!req.body.formats) {
                data.formats = [];
                if(user.email) data.formats.push('email');
                if(user.sms) data.formats.push('sms');
            }
            result = await n.notify(req.globalSettings, data, req.authGroup);
            return res.respond(say.noContent(RESOURCE));
        } catch (error) {
            if(result) {
                await n.deleteNotification(req.authGroup, result.id);
            }
            if(iAccessToken) {
                await iat.deleteOne(iAccessToken.jti, req.authGroup.id);
            }
            if(error.isAxiosError) {
                return next(Boom.failedDependency('There is an error with the global notifications service plugin - contact the admin'));
            }
            return next(error);
        }
    }
};

export default api;