import Boom from '@hapi/boom';
import dal from './dal';
import cl from '../oidc/client/clients';
import log from '../logging/logs';
import helper from '../../helper';
import eStream from './eventStream/eventStream';

export default {
	async initPlugins() {
		return dal.initPlugins();
	},
	async toggleGlobalMFASettings(data, userId, root) {
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
		/*
		todo generate a client at Root for Event Streams
		todo make sure you return clientId and ClientSecret
		// We may need something like this when we reintroduce auth...
		let client;
		if(data.enabled === true) {
			client = await cl.generateNotificationServiceClient(root);
			data.registeredClientId = client.client_id;
		}
		if(data.enabled === false) {
			await cl.deleteNotificationsServiceClient(root);
		}
		 */
		const lastSaved = await this.getLatestPluginOptions(true);
		if(data.currentVersion !== lastSaved.version) {
			throw Boom.badRequest('Must provide the current version to be incremented. If you thought you did, someone may have updated this before you.');
		}
		delete data.currentVersion;
		const update = JSON.parse(JSON.stringify(lastSaved));
		console.info(data);
		if (data?.enabled === false) {
			update.eventStream = {
				enabled: false
			};
		} else {
			await eStream.validateProvider(data?.provider);
			update.eventStream = data;
			console.info(update);
		}
		const saved = await dal.updatePlugins(lastSaved.version+1, update, userId);
		return {
			eventStream: {
				version: lastSaved.version+1,
				...saved.eventStream
			}
		};
	},
	async getLatestPluginOptions(bustCache = false) {
		let cache;
		if (bustCache !== true) {
			cache = await helper.getGlobalSettingsCache();
		}
		if(cache) return cache;
		const latest = await dal.getLatestPlugins({ 'createdAt': -1, 'version': -1 });
		await helper.setGlobalSettingsCache(latest);
		return latest;
	},
	// @notTested
	async auditPluginOptions() {
		return dal.auditPluginOptions();
	}
};

function setupMFA(lastSaved, type) {
	if(!lastSaved.mfaChallenge) {
		lastSaved.mfaChallenge = {
			enabled: true,
			providers: []
		};
	}
	lastSaved.mfaChallenge.enabled = true;
	// blow away previous privakey configuration
	lastSaved.mfaChallenge.providers = lastSaved.mfaChallenge.providers.filter((p) => {
		return (p.type !== type);
	});
	return lastSaved;
}