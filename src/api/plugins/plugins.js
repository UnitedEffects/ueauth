import Boom from '@hapi/boom';
import dal from './dal';
import cl from '../oidc/client/clients';
import log from '../logging/logs';
import helper from '../../helper';
import eStream from './eventStream/eventStream';

const config = require('../../config');

export default {
	async initPlugins() {
		return dal.initPlugins();
	},
	async toggleGlobalWebAuthN(data, userId, root) {
		if(root.prettyName !== 'root') throw Boom.unauthorized();
		const record = await this.getLatestPluginOptions(true);
		if(!record) throw Boom.internal('System may not have been initialized yet');
		if(data?.currentVersion !== record?.version) {
			throw Boom.badRequest('Must provide the current version to be incremented. If you thought you did, someone may have updated this before you.');
		}
		let lastSaved = JSON.parse(JSON.stringify(record));
		if(data.enabled === false) {
			lastSaved.webAuthN = {
				enabled: false,
				providers: []
			};
		} else {
			switch(data.type.toLowerCase()) {
			case 'privakey':
				lastSaved = setupWebAuthN(lastSaved, data.type.toLowerCase());
				lastSaved.webAuthN.providers.push({
					type: data.type.toLowerCase(),
					setup: data.setup || {}
				});
				break;
			default:
				throw Boom.badRequest('Unsupported mfa type requested');
			}
		}
		return dal.updatePlugins(lastSaved.version+1, lastSaved, userId);
	},
	async toggleGlobalMFASettings(data, userId, root) {
		if(root.prettyName !== 'root') throw Boom.unauthorized();
		let client;
		const record = await this.getLatestPluginOptions(true);
		if(!record) throw Boom.internal('System may not have been initialized yet');
		if(data?.currentVersion !== record?.version) {
			throw Boom.badRequest('Must provide the current version to be incremented. If you thought you did, someone may have updated this before you.');
		}
		let lastSaved = JSON.parse(JSON.stringify(record));
		if(data.enabled === false) {
			if(lastSaved?.mfaChallenge?.providers?.length !== 0) {
				await Promise.all(lastSaved.mfaChallenge.providers.map(async (p) => {
					if(p.type === 'http-proxy' && p.proxyClientId) {
						try {
							await cl.deleteOne(root, p.proxyClientId);
						} catch (error) {
							await log.error(`Issue removing plugin http-proxy mfa client with id ${p.proxyClientId}`);
						}
					}
					return p;
				}));
			}
			lastSaved.mfaChallenge = {
				enabled: false,
				providers: []
			};
		} else {
			switch(data.type.toLowerCase()) {
			case 'privakeysuper':
				lastSaved = setupMFA(lastSaved, data.type.toLowerCase());
				lastSaved.mfaChallenge.providers.push({
					type: data.type.toLowerCase(),
					privakeySuper: {
						id: data.privakeySuper.id,
						key: data.privakeySuper.key
					},
				});
				break;
			case 'privakey':
				lastSaved = setupMFA(lastSaved, data.type.toLowerCase());
				lastSaved.mfaChallenge.providers.push({
					type: data.type.toLowerCase()
				});
				break;
			case 'http-proxy':
				lastSaved = setupMFA(lastSaved, data.type.toLowerCase());
				if(!data.api || !data.api?.domain || !data.api?.challenge || !data.api?.validate ) {
					throw Boom.badRequest('http-proxy requires domain, challenge and validate api endpoints');
				}
				if(!data.proxyEnableScreen) {
					throw Boom.badRequest('http-proxy requires you to specify a browser based screen to direct the user to where they can bind their mobile device to a your MFA provider.');
				}
				client = await cl.generateRootServiceClient(root, 'global_mfa_proxy');
				lastSaved.mfaChallenge.providers.push({
					type: data.type.toLowerCase(),
					api: data.api,
					proxyClientId: client.client_id,
					proxyEnableScreen: data.proxyEnableScreen,
					proxyEnableInstructions: data.proxyEnableInstructions,
					proxyEnableScreenButtonText: data.proxyEnableScreenButtonText
				});
				break;
			default:
				throw Boom.badRequest('Unsupported mfa type requested');
			}
		}
		return dal.updatePlugins(lastSaved.version+1, lastSaved, userId);
	},
	async toggleGlobalNotifications(data, userId, root) {
		if(root.prettyName !== 'root') throw Boom.unauthorized();
		let client;
		if(data.enabled === true) {
			client = await cl.generateNotificationServiceClient(root);
			data.registeredClientId = client.client_id;
		}
		if(data.enabled === false) {
			await cl.deleteNotificationsServiceClient(root);
		}
		const lastSaved = await this.getLatestPluginOptions(true);
		if(data.currentVersion !== lastSaved.version) {
			throw Boom.badRequest('Must provide the current version to be incremented. If you thought you did, someone may have updated this before you.');
		}
		const update = JSON.parse(JSON.stringify(lastSaved));
		update.notifications = data;
		const saved = await dal.updatePlugins(lastSaved.version+1, update, userId);
		//const saved = await dal.toggleNotifications(lastSaved.version+1, update, userId);
		return {
			notifications: {
				enabled: saved.notifications.enabled || false,
				notificationServiceUri: saved.notifications.notificationServiceUri || undefined,
				notificationServiceClientId: saved.notifications.registeredClientId || undefined,
				notificationServiceClientSecret: (client) ? client.client_secret : undefined,
				plugins: {
					version: lastSaved.version+1,
				}
			}
		};
	},
	async toggleGlobalEventStreamSettings(data, userId, root) {
		if(root.prettyName !== 'root') throw Boom.unauthorized();
		const lastSaved = await this.getLatestPluginOptions(true);
		let client;
		if(data.enabled === true) {
			if(data.oauthRequired === true) {
				client = await cl.generateEventStreamingClient(root);
				if(!client) throw Boom.badRequest('Unable to generate a client at this time.');
			}
		}
		if(data.enabled === false) {
			if(lastSaved.eventStream?.provider?.oauthRequired === true) {
				await cl.deleteEventStreamingClient(root);
			}
			await eStream.clean(lastSaved);
		}
		if(data.currentVersion !== lastSaved.version) {
			throw Boom.badRequest('Must provide the current version to be incremented. If you thought you did, someone may have updated this before you.');
		}
		delete data.currentVersion;
		const authScopes = data.authScopes;
		delete data.authScopes;
		const update = JSON.parse(JSON.stringify(lastSaved));
		if (data?.enabled === false) {
			update.eventStream = {
				enabled: false
			};
		} else {
			await eStream.validateProvider(data?.provider);
			update.eventStream = data;
			if(data.oauthRequired === true) {
				const oauth = {
					issuerUrl: `${config.PROTOCOL}://${config.SWAGGER}/${root._id||root.id}`,
					clientId: client.client_id,
					rootRef: root.id || root._id,
					audience: `${config.PROTOCOL}://${config.SWAGGER}/${root._id||root.id}/streaming`,
					scope: authScopes
				};
				if(update.eventStream?.provider?.auth) {
					update.eventStream.provider.auth = {
						...update.eventStream.provider.auth,
						...oauth
					};
				} else update.eventStream.provider.auth = oauth;
			}
		}
		const saved = await dal.updatePlugins(lastSaved.version+1, update, userId);
		let output = {
			eventStream: {
				version: lastSaved.version+1,
				...saved.eventStream
			}
		};
		if(output.eventStream?.provider?.auth?.clientId && client?.client_secret){
			output = JSON.parse(JSON.stringify(output));
			output.eventStream.provider.auth.clientSecret = client.client_secret;
		}
		return output;
	},
	async getLatestPluginOptions(bustCache = false) {
		let cache;
		if (bustCache !== true) {
			cache = await helper.getGlobalSettingsCache();
		}
		if(cache) return cache;
		//const latest = await dal.getLatestPlugins({ 'createdAt': -1, 'version': -1 });
		const latest = await dal.getLatestPlugins({ 'version': -1 });
		await helper.setGlobalSettingsCache(latest);
		return latest;
	},
	// @notTested
	async auditPluginOptions() {
		return dal.auditPluginOptions();
	},
	async checkEventStreamingOnStartup() {
		if(config.DISABLE_STREAMS !== true) {
			const latest = await this.getLatestPluginOptions(true);
			if(latest?.eventStream?.enabled === true) {
				const describe = await eStream.describe(latest);
				if(describe.startup === true) {
					return eStream.startup(latest);
				}
			}
			return null;
		}
	}
};

function setupWebAuthN(lastSaved, type) {
	if(!lastSaved.webAuthN) {
		lastSaved.webAuthN = {
			enabled: true,
			providers: []
		};
	}
	lastSaved.webAuthN.enabled = true;
	// blow away previous configurations of same type
	lastSaved.webAuthN.providers = lastSaved.webAuthN.providers.filter((p) => {
		return (p.type !== type);
	});
	return lastSaved;
}

function setupMFA(lastSaved, type) {
	if(!lastSaved.mfaChallenge) {
		lastSaved.mfaChallenge = {
			enabled: true,
			providers: []
		};
	}
	lastSaved.mfaChallenge.enabled = true;
	// blow away previous configurations of same type
	lastSaved.mfaChallenge.providers = lastSaved.mfaChallenge.providers.filter((p) => {
		return (p.type !== type);
	});
	return lastSaved;
}