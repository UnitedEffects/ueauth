import { v4 as uuid } from 'uuid';

const et = {
	eventEmitter(provider, group) {
		const list = getEventList(group);
		list.forEach((item) => {
			OP_EVENTS[item].forEach((event) => {
				processStream(provider, event);
			});
		});
	}
};

function getEventList(group) {
	const list = [];
	Object.keys(group.config.eventEmitter).map((key) => {
		if(group.config.eventEmitter[key] === true) list.push(key);
	});
	return list;
}


function processStream(provider, event) {
	provider.on(event, (ctx, ...args) => {
		const emit = {
			id: uuid(), //to help find this in a log
			event,
			eventTime: Date.now(),
		};
		const msg = event.split('.');
		if(msg.length>1) {
			emit.message = msg[msg.length-1];
		}
		emit.data = (ctx.oidc) ? JSON.parse(JSON.stringify(ctx.oidc.entities)) : JSON.parse(JSON.stringify(ctx));
		if(args.length > 0) {
			emit.details = args;
		}
		console.info(emit);
	});
}


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
	backChannel: [
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
		'userinfo.error'	//(ctx, error)
	]
};

export default et;