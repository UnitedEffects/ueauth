import {v4 as uuid} from 'uuid';
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
		'ue.account.error'
	],
	group: [
		'ue.group.create',
		'ue.group.edit',
		'ue.group.error',
		'ue.group.destroy',
		'ue.group.initialize'
	],
	invite: [
		'ue.invite.create',
		'ue.invite.destroy',
		'ue.invite.accepted',
		'ue.invite.declined',
		'ue.invite.resent',
		'ue.invite.error'
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
	]
};

function getEventList() {
	const list = [];
	Object.keys(config.EVENT_EMITTER).map((key) => {
		if(config.EVENT_EMITTER[key] === true) list.push(key);
	});
	return list;
}

function processProviderStream(provider, event, clean, group, UE = false) {
	const eventType = event.split('.');
	if((eventType[0] === 'ue') === UE) {
		provider.on(event, (ctx, ...args) => {
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
				emit.data = (ctx.oidc) ? JSON.parse(JSON.stringify(ctx.oidc.entities)) : JSON.parse(JSON.stringify(ctx));
				if (args.length > 0) {
					emit.details = args;
				}
			} else {
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
			// emitter - we can hook this up to an external event system from here later
			console.info(emit);
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