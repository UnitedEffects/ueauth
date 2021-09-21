import Boom from '@hapi/boom';
import { say } from '../../say';
import acct from './account';
import group from '../authGroup/group';
import iat from '../oidc/initialAccess/iat';
import cl from '../oidc/client/clients';
import permissions from '../../permissions';
import n from '../plugins/notifications/notifications';
import ueEvents from '../../events/ueEvents';
const cryptoRandomString = require('crypto-random-string');

const RESOURCE = 'Account';

const api = {
    async writeAccount(req, res, next) {
        try {
            if (req.groupActivationEvent === true) return api.activateGroupWithAccount(req, res, next);
            if (req.authGroup.active === false) return next(Boom.forbidden('You can not add members to an inactive group'));
            if (!req.body.email) return next(Boom.preconditionRequired('username is required'));
            if (req.body.generatePassword === true) {
                req.body.password = cryptoRandomString({length: 32, type: 'url-safe'});
            }
            if (!req.body.password) return next(Boom.preconditionRequired('password is required'));
            const password = req.body.password;
            delete req.body.generatePassword; //clean up
            if (req.user && req.user.sub) req.body.modifiedBy = req.user.sub;
            const result = await acct.writeAccount(req.body);
            try {
                if (req.globalSettings.notifications.enabled === true &&
                    req.authGroup.pluginOptions.notification.enabled === true &&
                    req.authGroup.config.autoVerify === true) {
                    await acct.resetOrVerify(req.authGroup, req.globalSettings, result,[], (req.user) ? req.user.sub : undefined, false);
                }
            } catch (er) {
                console.error(er);
                throw Boom.failedDependency('You have automatic email verification enabled but something went wrong. The user should trigger a forgot password to verify the account.', {account: result, error: er.stack || er.message});
            }
            const output = JSON.parse(JSON.stringify(result));
            output.password = password;
            /**
             *         'ue.account.create',
             'ue.account.edit',
             'ue.account.destroy',
             'ue.account.error'
             */
            ueEvents.stream.emit(`ue.account.create-${req.authGroup.id}`, output);
            return res.respond(say.created(output, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async activateGroupWithAccount(req, res, next) {
        let account;
        let client;
        try {
            req.body.verified = true;
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
                //console.info(req.authInfo);
                const result = await iat.deleteOne(req.authInfo.token._id, req.authGroup._id);
                //console.info(result);
            } catch (error) {
                console.error(error);
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
            const id = (req.params.id === 'me') ? req.user.sub : req.params.id;
            await permissions.enforceOwn(req.permissions, id);
            const result = await acct.getAccount(req.params.group, id);
            if (!result) return next(Boom.notFound(`id requested was ${id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async patchAccount(req, res, next) {
        try {
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            let bpwd = false;
            if(req.body && Array.isArray(req.body)){
                for(let i=0; i<req.body.length; i++) {
                    if(req.body[i].op === 'replace' && req.body[i].path === '/password') bpwd = true;
                }
            }
            if(req.user && req.user.decoded && req.user.decoded.kind === 'InitialAccessToken') {
                if (req.body) {
                    if(req.body.length > 1 || req.body[0].path !== '/password' || req.body[0].op !== 'replace') {
                        throw Boom.methodNotAllowed();
                    }
                }
            }
            await permissions.enforceOwn(req.permissions, req.params.id);
            const result = await acct.patchAccount(req.authGroup, req.params.id, req.body, req.user.sub || req.user.id || 'SYSTEM', bpwd);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async deleteAccount(req, res, next) {
        try {
            if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
            if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
            await permissions.enforceOwn(req.permissions, req.params.id);
            if(req.authGroup.owner === req.params.id) throw Boom.badRequest('You can not delete the owner of the auth group');
            const result = await acct.deleteAccount(req.params.group, req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },

    async resetPassword(req, res, next) {
        let result;
        try {
            if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
            if(!req.body.email) throw Boom.preconditionRequired('Must provide email address');
            if(req.globalSettings.notifications.enabled === false) throw Boom.methodNotAllowed('There is no Global Notification Plugin enabled. You will need the admin to reset your password directly and inform you of the new password');
            if(req.authGroup.pluginOptions.notification.enabled === false) throw Boom.methodNotAllowed('Your admin has not enabled notifications. You will need the admin to reset your password directly and inform you of the new password');
            const user = await acct.getAccountByEmailOrUsername(req.authGroup.id, req.body.email, req.authGroup.config.requireVerified);
            if(!user) throw Boom.notFound('This email address is not registered with our system');
            result = await acct.resetOrVerify(req.authGroup, req.globalSettings, user, req.body.formats, undefined, true);
            return res.respond(say.noContent(RESOURCE));
        } catch (error) {
            if(result) {
                await n.deleteNotification(req.authGroup, result.id);
            }
            if(error.isAxiosError) {
                return next(Boom.failedDependency('There is an error with the global notifications service plugin - contact the admin'));
            }
            return next(error);
        }
    },
    async userOperations(req, res, next) {
        try {
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            if (!req.body.operation) return res.respond(say.noContent('User Operation'));
            let result;
            switch (req.body.operation) {
                case "verify_account":
                    try {
                        if (req.globalSettings.notifications.enabled === true &&
                            req.authGroup.pluginOptions.notification.enabled === true) {
                            const user = await acct.getAccount(req.authGroup.id, req.params.id);
                            await permissions.enforceOwn(req.permissions, user.id);
                            result = await acct.resetOrVerify(req.authGroup, req.globalSettings, user,[], req.user.sub, false);
                            return res.respond(say.noContent(RESOURCE));
                        }
                        throw Boom.badRequest('Notifications are not enabled and are required for this operation');
                    } catch (error) {
                        if(result) {
                            await n.deleteNotification(req.authGroup, result.id);
                        }
                        throw error
                    }
                case "password_reset":
                    try {
                        if (req.globalSettings.notifications.enabled === true &&
                            req.authGroup.pluginOptions.notification.enabled === true) {
                            const user = await acct.getAccount(req.authGroup.id, req.params.id);
                            await permissions.enforceOwn(req.permissions, user.id);
                            result = await acct.resetOrVerify(req.authGroup, req.globalSettings, user,[], req.user.sub, true);
                            return res.respond(say.noContent(RESOURCE));
                        }
                        throw Boom.badRequest('Notifications are not enabled and are required for this operation');
                    } catch (error) {
                        if(result) {
                            await n.deleteNotification(req.authGroup, result.id);
                        }
                        throw error;
                    }
                case "generate_password":
                    const password = cryptoRandomString({length: 32, type: 'url-safe'});
                    const user = await acct.getAccount(req.authGroup.id, req.params.id);
                    await permissions.enforceOwn(req.permissions, user.id);
                    result = await acct.updatePassword(req.authGroup.id, req.params.id, password, (req.user) ? req.user.sub : undefined);
                    return res.respond(say.ok(result, RESOURCE));
                default:
                    throw Boom.badRequest('Unknown operation');
            }
        } catch (error) {
            if(error.isAxiosError) {
                return next(Boom.failedDependency('There is an error with the global notifications service plugin - contact the admin'));
            }
            next(error);
        }
    }
};

export default api;