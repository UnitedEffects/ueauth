import {v4 as uuid} from 'uuid';
import helper from '../helper';
import eStream from '../api/plugins/eventStream/eventStream';
const config = require('../config');

const OP_EVENTS = {
	general: [
		'jwks.error',	//(ctx, error)
		'revocation.error',	//(ctx, error)
		'server_error',	//(ctx, error)
		'discovery.error',	//(ctx, error)
		'introspection.error',	//(ctx, error)
	],
	accessToken: [
		'access_token.destroyed', //token
		'access_token.saved', //token
		'access_token.issued', //token
	],
	authorization: [
		'authorization_code.consumed', //code
		'authorization_code.destroyed', //code
		'authorization_code.saved', //code
		'authorization.accepted', //ctx
		'authorization.error', //ctx, error
		'authorization.success', //ctx
	],
	backchannel: [
		'backchannel.error', //(ctx, error, client, accountId, sid)
		'backchannel.success',	//(ctx, client, accountId, sid)
	],
	clientCredentials: [
		'client_credentials.saved',	//(token)
		'client_credentials.destroyed',	//(token)
		'client_credentials.issued',	//(token)
	],
	deviceCode: [
		'device_code.consumed',	//(code)
		'device_code.destroyed',	//(code)
		'device_code.saved',	//(code)
	],
	session: [
		'end_session.error',	//(ctx, error)
		'end_session.success',	//(ctx)
		'session.destroyed',	//(session)
		'session.saved',	//(session)
	],
	grant: [
		'grant.error',	//(ctx, error)
		'grant.revoked',	//(ctx, grantId)
		'grant.success',	//(ctx)
	],
	iat: [
		'initial_access_token.destroyed',	//(token)
		'initial_access_token.saved',	//(token)
	],
	uiInteraction: [
		'interaction.destroyed',	//(interaction)
		'interaction.ended',	//(ctx)
		'interaction.saved',	//(interaction)
		'interaction.started',	//(ctx, prompt)
	],
	replayDetection: [
		'replay_detection.destroyed',	//(token)
		'replay_detection.saved',	//(token)
	],
	pushedAuthorization: [
		'pushed_authorization_request.error',	//(ctx, error)
		'pushed_authorization_request.success',	//(ctx, client)
		'pushed_authorization_request.destroyed',	//(token)
		'pushed_authorization_request.saved',	//(token)
	],
	refreshToken: [
		'refresh_token.consumed',	//(token)
		'refresh_token.destroyed',	//(token)
		'refresh_token.saved',	//(token)
	],
	registration: [
		'registration_access_token.destroyed',	//(token)
		'registration_access_token.saved',	//(token)
		'registration_create.error',	//(ctx, error)
		'registration_create.success',	//(ctx, client)
		'registration_delete.error',	//(ctx, error)
		'registration_delete.success',	//(ctx, client)
		'registration_read.error',	//(ctx, error)
		'registration_update.error',	//(ctx, error)
		'registration_update.success',	//(ctx, client)
	],
	account: [
		'userinfo.error',	//(ctx, error)
		'ue.account.create',
		'ue.account.edit',
		'ue.account.destroy',
		'ue.account.error',
		'ue.account.import.error'
	],
	group: [
		'ue.group.create',
		'ue.group.edit',
		'ue.group.error',
		'ue.group.destroy',
		'ue.group.initialize'
	],
	pluginNotification: [
		'ue.plugin.notification.create',
		'ue.plugin.notification.sent',
		'ue.plugin.notification.error'
	],
	organization: [
		'ue.organization.create',
		'ue.organization.edit',
		'ue.organization.destroy',
		'ue.organization.error'
	],
	domain: [
		'ue.domain.create',
		'ue.domain.edit',
		'ue.domain.destroy',
		'ue.domain.error'
	],
	product: [
		'ue.product.create',
		'ue.product.edit',
		'ue.product.destroy',
		'ue.product.error'
	],
	role: [
		'ue.role.create',
		'ue.role.edit',
		'ue.role.destroy',
		'ue.role.error'
	],
	access: [
		'ue.client.access.defined',
		'ue.client.access.destroy',
		'ue.client.access.update',
		'ue.client.access.error',
		'ue.key.access.defined',
		'ue.key.access.refreshed',
		'ue.key.access.destroy',
		'ue.key.access.error',
		'ue.access.defined',
		'ue.access.destroy',
		'ue.access.error'
	],
	permission: [
		'ue.permission.create',
		'ue.permission.destroy',
		'ue.permission.error'
	],
	orgProfile: [
		'ue.organization.profile.create',
		'ue.organization.profile.edit',
		'ue.organization.profile.destroy',
		'ue.organization.profile.error'
	],
	securedProfile: [
		'ue.secured.profile.create',
		'ue.secured.profile.edit',
		'ue.secured.profile.destroy',
		'ue.secured.profile.error',
		'ue.secured.profile.organization.synced',
		'ue.secured.profile.copy.created',
		'ue.secured.profile.copy.destroyed',
		'ue.secured.profile.copy.updated',
		'ue.secured.profile.access.denied',
		'ue.secured.profile.access.approved',
		'ue.secured.profile.access.requested',
		'ue.secured.profile.view.created',
		'ue.secured.profile.view.destroyed'
	]
};

async function getEventList(groupId) {
	let eventsToLoad = {};
	if(config.DISABLE_STREAMS !== true) {
		eventsToLoad = config.EVENT_EMITTER;
		if(groupId) {
			const group = await helper.getAGFromCache(groupId);
			if(group?.config?.logEventGroups) eventsToLoad = group.config.logEventGroups;
		}
	}
	const list = [];
	Object.keys(eventsToLoad).map((key) => {
		if(eventsToLoad[key] === true) list.push(key);
	});
	return list;
}

function processProviderStream(provider, event, clean, group, UE = false) {
	const eventType = event.split('.');
	if((eventType[0] === 'ue') === UE) {
		provider.on(event, async (ctx, ...args) => {
			const emit = {
				id: uuid(), //to help find this in a log
				group,
				event: event.split(':')[0],
				eventTime: Date.now(),
			};
			const msg = event.split('.');
			if (msg.length > 1) {
				emit.message = msg[msg.length - 1].split(':')[0];
			}
			if (!clean) {
				if(ctx) {
					emit.data = (ctx.oidc) ? JSON.parse(JSON.stringify(ctx.oidc.entities)) : JSON.parse(JSON.stringify(ctx));
					if (args.length > 0) {
						emit.details = args;
					}
				}
			} else {
				if(ctx) {
					let data = {};
					const object = (ctx.oidc) ? ctx.oidc.entities : ctx;
					if (!ctx.oidc) {
						data = cleanArgs([object]);
					} else {
						data = cleanArgs(object);
					}
					emit.data = JSON.parse(JSON.stringify(data));
					if (args.length > 0) {
						emit.details = cleanArgs(args);
					}
				}
			}
			let AG;
			try {
				AG = await helper.cacheAG(false, 'AG', group);
			} catch (error) {
				console.info('unknown AG, possibly new');
				//if(config.ENV === 'test') throw new Error('Auth Group not found');
			}

			if(AG?.pluginOptions?.externalStreaming?.enabled === true) {
				// not waiting for this
				eStream.publish(AG, emit).catch((error) => {
					console.error('UNABLE TO STREAM EXTERNALLY - NOT THROWING ERROR - OUTPUTTING TO CONSOLE INSTEAD');
					if(config.ENV !== 'production') console.error(error?.response?.data || error);
					console.info(JSON.stringify(emit, null, 2));
				});
			} else console.info(JSON.stringify(emit, null, 2));
		});
	}
}

function cleanArgs(args) {
	let name;
	let temp = {};
	let data = [];
	if (Array.isArray(args)) {
		for(let i=0; i<args.length; i++) {
			temp[`arg_${i}`] = args[i];
		}
	} else {
		temp = args;
	}
	Object.keys(temp).map((key) => {
		if(typeof temp[key] === 'object') {
			name = providerInstance(temp[key]);
			data.push(cleanObject(temp[key], name));
		} else data.push(temp[key]);
	});
	return data;
}

function cleanObject(obj, name) {
	if(name === 'TypeError') return obj;
	let temp = JSON.parse(JSON.stringify(obj));
	switch (name) {
	case 'Session':
		delete temp.authorizations;
		delete temp.jti;
		delete temp.oldId;
		return temp;
	case 'Grant':
		delete temp.authorizations;
		delete obj.jti;
		if(temp.session){
			delete temp.session.cookie;
		}
		return temp;
	case 'Interaction':
		delete temp.prompt;
		delete temp.params;
		delete temp.jti;
		if(temp.session){
			delete temp.session.cookie;
		}
		return temp;
	case 'Client':
		return {
			clientName: obj.clientName,
			clientId: obj.clientId,
			authGroup: obj.auth_group,
		};
	case 'Object':
	default:
		// attempting to delete anything unexpected
		delete temp.format;
		delete temp.jti;
		delete temp.password;
		delete temp.code;
		delete temp.access_token;
		delete temp.accessToken;
		delete temp.state;
		delete temp.client_secret;
		delete temp.clientSecret;
		delete temp.nonce;
		delete temp.id_token;
		delete temp.idToken;
		delete temp.jti;
		delete temp.authorizations;
		delete temp.aud;
		delete temp.scope;
		delete temp.resource;
		delete temp.redirectUri;
		if(temp.config) {
			delete temp.config.keys;
		}
		return temp;
	}
}

function providerInstance(obj) {
	if(obj.constructor) {
		return obj.constructor.name;
	}
	return undefined;
}

export default {
	getEventList,
	processProviderStream,
	cleanArgs,
	cleanObject,
	providerInstance,
	items: OP_EVENTS
};