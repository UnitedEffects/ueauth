import Boom from '@hapi/boom';
import { say } from '../../say';
import group from './group';
import helper from '../../helper';
import iat from '../oidc/initialAccess/iat';
import cl from "../oidc/client/clients";
import acct from "../accounts/account";
import plugs from '../plugins/plugins';
import permissions from "../../permissions";
const config = require('../../config');


const RESOURCE = 'Auth Group';

const api = {
    async initialize(req, res, next) {
        let g;
        let account;
        let client;
        let final;
        let plugins;
        try {
            // when not allowed, we'll just say not found. No need to point at a security feature.
            if(config.ALLOW_ROOT_CREATION!==true) return next(Boom.notFound());
            if(!config.ONE_TIME_PERSONAL_ROOT_CREATION_KEY) return next(Boom.notFound());
            if(config.ONE_TIME_PERSONAL_ROOT_CREATION_KEY === "") return next(Boom.notFound());
            if(!req.body.setupCode) return next(Boom.notFound());
            // after here we assume they should know about the endpoint
            if(req.body.setupCode !== config.ONE_TIME_PERSONAL_ROOT_CREATION_KEY) return next(Boom.unauthorized());
            if(!config.ROOT_EMAIL) return next(Boom.badData('Root Email Not Configured'));
            if(!req.body.password) return next(Boom.badData('Need to provide a password for initial account'));
            const check = await group.getOneByEither('root');
            if(check) return next(Boom.forbidden('root is established, this action is forbidden'));
            // finished security and data checks, proceeding
            const gData = {
                name: "root",
                prettyName: "root",
                locked: true,
                primaryDomain: `https://${config.UI_URL}`,
                owner: config.ROOT_EMAIL
            };
            const aData = {
                username: config.ROOT_EMAIL,
                email: config.ROOT_EMAIL,
                password: req.body.password,
                verified: true
            }
            g = await group.write(gData);
            aData.authGroup = g.id;
            account = await acct.writeAccount(aData);
            client = await cl.generateClient(g);
            final = JSON.parse(JSON.stringify(await group.activateNewAuthGroup(g, account, client.client_id)));
            if(final.config) delete final.config.keys;
            try {
                plugins = await plugs.initPlugins();
            } catch (error) {
                console.info('Plugins did not initialize - this is not a blocker but a warning');
                console.error(error);
            }
            const out = {
                WARNING: "NOW THAT YOU HAVE FINISHED INITIAL SETUP, REDEPLOY THIS SERVICE WITH ALLOW_ROOT_CREATION SET TO FALSE AND ONE_TIME_PERSONAL_ROOT_CREATION_KEY SET TO EMPTY STRING",
                account,
                authGroup: final,
                client,
                plugins
            };
            return res.respond(say.created(out, RESOURCE));
        } catch (error) {
            if (g) {
                try {
                    const gDone = await group.deleteOne(g.id)
                    if(!gDone) throw new Error('group delete not complete');
                } catch (error) {
                    console.error(error);
                    console.error('Root Group Rollback: There was a problem and you may need to debug this install');
                }
            }
            if (account) {
                try {
                    const aDone = await acct.deleteAccount(g.id, account._id);
                    if(!aDone) throw new Error('account delete not complete');
                } catch (error) {
                    console.error(error);
                    console.info('Account Rollback: There was a problem and you may need to debug this install');
                }
            }
            if (client) {
                try {
                    const cDone = await cl.deleteOne(g, client.client_id);
                    if(!cDone) throw new Error('client delete not complete');
                } catch (error) {
                    console.error(error);
                    console.info('Client Rollback: There was a problem and you may need to debug this install');
                }
            }
            next(error);
        }
    },
    async check(req, res, next) {
        try {
            if(!req.params.prettyName) return next(Boom.preconditionRequired('Need the Pretty Name you want to check'));
            if(helper.protectedNames(req.params.prettyName)) return  res.respond(say.accepted({ available: false }, RESOURCE));
            const result = await group.check(req.params.prettyName);
            if(result === true) return res.respond(say.accepted({ available: true }, RESOURCE));
            return res.respond(say.accepted({ available: false}, RESOURCE));
        } catch (error) {
            next(error)
        }
    },
    async write(req, res, next) {
        let result;
        try {
            if (!req.body.name) return next(Boom.preconditionRequired('name is required'));
            if (req.body.prettyName) {
                if(helper.protectedNames(req.body.prettyName)) return  next(Boom.forbidden('Protected Namespace'));
            }
            //move this logic to group.js
            req.body.securityExpiration = new Date(Date.now() + (config.GROUP_SECURE_EXPIRES * 1000));
            result = JSON.parse(JSON.stringify(await group.write(req.body)));
            const expiresIn = 86400 + config.GROUP_SECURE_EXPIRES;
            const token = await iat.generateIAT(expiresIn, ['auth_group'], result);
            result.initialAccessToken = token.jti;
            if(result.config) delete result.config.keys;
            return res.respond(say.created(result, RESOURCE));
        } catch (error) {
            if (result && result.id) {
                try {
                    await group.deleteOne(result.id);
                } catch (error) {
                    console.error('Attempted and failed cleanup');
                }
            }
            next(error);
        }
    },
    async get(req, res, next) {
        try {
            const result = await group.get(req.query);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async getOne(req, res, next) {
        try {
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            const result = await group.getOne(req.params.id);
            if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
            await permissions.enforceOwn(req.permissions, result.owner);
            const output = JSON.parse(JSON.stringify(result));
            if(output.config) delete output.config.keys;
            return res.respond(say.ok(output, RESOURCE));
        } catch (error) {
            next(error);
        }
    },
    async patch(req, res, next) {
        try {
            //todo add modifiedBy
            const grp = await group.getOne(req.params.id);
            if(!grp) throw Boom.notFound(`id requested was ${req.params.id}`);
            await permissions.enforceOwn(req.permissions, grp.owner);
            const result = await group.patch(grp, req.body);
            const output = JSON.parse(JSON.stringify(result));
            if(output.config) delete output.config.keys;
            return res.respond(say.ok(output, RESOURCE));
        } catch (error) {
            next(error);
        }
    },

    async operations(req, res, next) {
        try {
            //todo add modifiedBy
            const body = req.body;
            if(!body.operation) next(Boom.badData('must specify operation'));
            const result = await group.operations(req.authGroup.id, body.operation);
            if(result.config) delete result.config.keys;
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    }
};

export default api;