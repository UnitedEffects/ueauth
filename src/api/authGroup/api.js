import Boom from '@hapi/boom';
import { say } from '../../say';
import group from './group';
import helper from '../../helper';
import cl from '../oidc/client/clients';
import acct from '../accounts/account';
import plugs from '../plugins/plugins';
import ueEvents from '../../events/ueEvents';
import initAccess from '../../initUEAuth';
import permissions from '../../permissions';
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
			if(config.ONE_TIME_PERSONAL_ROOT_CREATION_KEY === '') return next(Boom.notFound());
			if(!req.body.setupCode) return next(Boom.notFound());
			// after here we assume they should know about the endpoint
			if(req.body.setupCode !== config.ONE_TIME_PERSONAL_ROOT_CREATION_KEY) return next(Boom.unauthorized());
			if(!config.ROOT_EMAIL) return next(Boom.badData('Root Email Not Configured'));
			if(!req.body.password) return next(Boom.badData('Need to provide a password for initial account'));
			const check = await group.getOneByEither('root');
			if(check) return next(Boom.forbidden('root is established, this action is forbidden'));
			// finished security and data checks, proceeding
			const gData = {
				name: 'root',
				prettyName: 'root',
				locked: true,
				primaryDomain: config.INIT_ROOT_PRIMARY_DOMAIN,
				primaryTOS: config.INIT_ROOT_PRIMARY_TOS,
				primaryPrivacyPolicy: config.INIT_ROOT_PRIMARY_POLICY,
				owner: config.ROOT_EMAIL
			};
			const aData = {
				username: config.ROOT_EMAIL,
				email: config.ROOT_EMAIL,
				password: req.body.password,
				verified: true
			};
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
			const access = await initAccess.createDefaultOrgAndDomain(final, account);
			const out = {
				WARNING: 'NOW THAT YOU HAVE FINISHED INITIAL SETUP, REDEPLOY THIS SERVICE WITH ALLOW_ROOT_CREATION SET TO FALSE AND ONE_TIME_PERSONAL_ROOT_CREATION_KEY SET TO EMPTY STRING',
				account,
				authGroup: final,
				client,
				plugins,
				access
			};
			return res.respond(say.created(out, RESOURCE));
		} catch (error) {
			if (g) {
				try {
					const gDone = await group.deleteOneCleanup(g.id);
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
			ueEvents.emit('root', 'ue.group.error', error);
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
			next(error);
		}
	},
	async write(req, res, next) {
		let result;
		try {
			if (!req.body.name) return next(Boom.preconditionRequired('name is required'));
			if (req.body.prettyName) {
				if(helper.protectedNames(req.body.prettyName)) return  next(Boom.forbidden('Protected Namespace'));
			}
			if (config.OPEN_GROUP_REG === false) {
				await permissions.enforceRoot(req.permissions);
			}
			result = await group.write(req.body);
			let output = await group.completeGroupSignup(result, req.globalSettings, req.body.owner);
			output = includeSSORedirectUris(output);
			return res.respond(say.created(output, RESOURCE));
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
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
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
			let output = JSON.parse(JSON.stringify(result));
			if(output.config) {
				if(await permissions.canAccessGroupKeys(req.permissions) === false) delete output.config.keys;
			}
			output = includeSSORedirectUris(output);
			return res.respond(say.ok(output, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async patch(req, res, next) {
		try {
			console.info(req.user);
			const grp = await group.getOne(req.params.id);
			if(!grp) throw Boom.notFound(`id requested was ${req.params.id}`);
			const result = await group.patch(grp, req.body, req.user.sub || 'SYSTEM', req.globalSettings);
			let output = JSON.parse(JSON.stringify(result));
			if(output.config) delete output.config.keys;
			output = includeSSORedirectUris(output);
			return res.respond(say.ok(output, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.group.error', error);
			next(error);
		}
	},
	async operations(req, res, next) {
		try {
			const body = req.body;
			if(!body.operation) next(Boom.badData('must specify operation'));
			const result = await group.operations(req.authGroup.id, body.operation, req.user);
			if(result.config) delete result.config.keys;
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.group.error', error);
			next(error);
		}
	},
	async addAliasDns(req, res, next) {
		// create or overwrite the aliasDns entries on the group. This does not delete
		let result;
		try {
			const body = req.body;
			await permissions.enforceRoot(req.permissions);
			result = await group.updateAliasDns(req.params.id, body, req.user.sub || 'ROOT_SYSTEM_ADMIN');
			const client = await cl.getOneByAgId(req.params.id, result.associatedClient);
			if(!client) throw Boom.badData('Associated client not found');
			const pl = JSON.parse(JSON.stringify(client.payload));
			if(!client.payload || !pl.redirect_uris || !Array.isArray(pl.redirect_uris)) throw Boom.badData('Something went wrong updating the client redirect-uri for this authgroup');
			if(!pl.post_logout_redirect_uris || !Array.isArray(pl.post_logout_redirect_uris)) throw Boom.badData('Something went wrong updating the client post-logout-redirect-uri for this authgroup');
			const update = {
				'payload.redirect_uris': pl.redirect_uris,
				'payload.post_logout_redirect_uris': pl.post_logout_redirect_uris
			};

			if(body.aliasDnsUi) {
				update['payload.redirect_uris'] = update['payload.redirect_uris'].concat([`https://${result.aliasDnsUi}`, `https://${result.aliasDnsUi}${config.UI_LOGIN_REDIRECT_PATH}`]);
				update['payload.post_logout_redirect_uris'] = update['payload.post_logout_redirect_uris'].concat([`https://${result.aliasDnsUi}`, `https://${result.aliasDnsUi}${config.UI_LOGOUT_REDIRECT_PATH}`]);
			}

			if(body.aliasDnsOIDC) {
				update['payload.redirect_uris'] = update['payload.redirect_uris'].concat([`https://${result.aliasDnsOIDC}/oauth2-redirect.html`]);
				update['payload.post_logout_redirect_uris'] = update['payload.post_logout_redirect_uris'].concat([`https://${result.aliasDnsOIDC}/oauth2-redirect.html`]);
			}

			update['payload.redirect_uris'] = [...new Set(update['payload.redirect_uris'])];
			update['payload.post_logout_redirect_uris'] = [...new Set(update['payload.post_logout_redirect_uris'])];

			await cl.simplePatch(req.params.id, result.associatedClient, update);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			if(result) {
				await group.removeAliasDns(req.params.id, req.user.sub || 'ROOT_SYSTEM_ADMIN');
			}
			ueEvents.emit(req.params.id, 'ue.group.error', error);
			next(error);
		}
	},
	async removeAliasDns(req, res, next) {
		// deletes both aliasDns entries from an authGroup
		try {
			await permissions.enforceRoot(req.permissions);
			if(!req.params.target) throw Boom.preconditionRequired('Target of UI or OIDC required');
			const result = await group.removeAliasDns(req.params.id, req.user.sub || 'ROOT_SYSTEM_ADMIN', req.params.target);
			const client = await cl.getOneByAgId(req.params.id, result.associatedClient);
			if(!client) throw Boom.badData('Associated client not found');
			const pl = JSON.parse(JSON.stringify(client.payload));
			if(!client.payload || !pl.redirect_uris || !Array.isArray(pl.redirect_uris)) throw Boom.badData('Something went wrong updating the client redirect-uri for this authgroup');
			if(!pl.post_logout_redirect_uris || !Array.isArray(pl.post_logout_redirect_uris)) throw Boom.badData('Something went wrong updating the client post-logout-redirect-uri for this authgroup');
			const update = {
				'payload.redirect_uris': pl.redirect_uris,
				'payload.post_logout_redirect_uris': pl.post_logout_redirect_uris
			};

			if(req.params.target === 'ui') {
				update['payload.redirect_uris'] = update['payload.redirect_uris'].filter((url) => {
					return (!url.includes(req.authGroup.aliasDnsUi));
				});
				update['payload.post_logout_redirect_uris'] = update['payload.post_logout_redirect_uris'].filter((url) => {
					return (!url.includes(req.authGroup.aliasDnsUi));
				});
			}

			if(req.params.target === 'oidc') {
				update['payload.redirect_uris'] = update['payload.redirect_uris'].filter((url) => {
					return (!url.includes(req.authGroup.aliasDnsOIDC));
				});
				update['payload.post_logout_redirect_uris'] = update['payload.post_logout_redirect_uris'].filter((url) => {
					return (!url.includes(req.authGroup.aliasDnsOIDC));
				});
			}
			await cl.simplePatch(req.params.id, result.associatedClient, update);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.params.id, 'ue.group.error', error);
			next(error);
		}
	},
	async getPublicGroupInfo(req, res, next) {
		try {
			const ag = req.params.group;
			const result = await group.getPublicOne(ag);
			if(!result) throw Boom.notFound(ag);
			const out = {
				searched: ag,
				group: result.prettyName,
				name: result.name,
				id: result.associatedClient
			};
			return res.respond(say.ok(out, RESOURCE));
		} catch (error) {
			next(error);
		}
	}
};

function includeSSORedirectUris(output) {
	if(output.config && output.config.federate) {
		Object.keys(output.config.federate).map((key) => {
			if(output.config.federate[key] && output.config.federate[key].length) {
				output.config.federate[key].map((connect, index) => {
					output.config.federate[key][index].redirectUris = [];
					output.config.federate[key][index].redirectUris.push(`${config.PROTOCOL}://${config.SWAGGER}/${output._id||output.id}/interaction/callback/${key}/${connect.provider.toLowerCase()}/${connect.name.replace(/ /g, '_').toLowerCase()}`);
					if(output.aliasDnsOIDC) {
						output.config.federate[key][index].redirectUris.push(`${config.PROTOCOL}://${output.aliasDnsOIDC}/${output._id||output.id}/interaction/callback/${key}/${connect.provider.toLowerCase()}/${connect.name.replace(/ /g, '_').toLowerCase()}`);
					}
				});
			}
		});
	}
	return output;
}

export default api;