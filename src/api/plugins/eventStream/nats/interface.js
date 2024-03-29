import Boom from '@hapi/boom';
import n from './cache/nats';
import napi from './nats';
import Nats from './startup';

export default {
	async validateSettings(provider) {
		if(provider.restAuth === true) throw Boom.badData('NATS does not use a REST API');
		if(provider.streamAuth === true && !provider.auth?.userSeed) {
			throw Boom.badData('You will need to provide a user seed so NATS can authorize client connections');
		}
		if(provider.streamAuth === true && !provider.auth?.userPublicKey) {
			throw Boom.badData('If you are enabling auth, please provide your userPublicKey');
		}
		if(!provider.streamUrl) throw Boom.badData('NATS url required');
		if(!provider.clientConfig?.stream) throw Boom.badData('Please specify the stream name UEAUTH should use to send data');
		if(!provider.clientConfig?.subject) throw Boom.badData('Please specify the subject name UEAUTH should use to send data');
		if(!provider.clientConfig.subject.includes('{authGroup}')) throw Boom.badData('The subject should have a parameter somewhere to allow the auth group to be specified. For example "sub.{authGroup}.logs"');
		if(provider.clientConfig?.coreSimpleStream === true && !provider.auth?.jwtIssuer) {
			throw Boom.badData('If you are using Core Simple Stream powered by NATS, you need to provide the "jwtIssuer" url for Core EOS so new JWTs can be created as needed');
		}
		if(provider.clientConfig?.coreSimpleStream === true && !provider.auth?.clientId) {
			throw Boom.badData('If you are using Core Simple Stream powered by NATS, you need to provide the "clientId" associated with this access object jwtIssuer.');
		}
		if(provider.clientConfig?.coreSimpleStream === true && !provider.auth?.authGroup) {
			throw Boom.badData('If you are using Core Simple Stream powered by NATS, you need to provide the "authGroup" associated with this clientId. Usually this will be the Root AuthGroup ID.');
		}
		if(provider.clientConfig?.coreSimpleStream !== true && !provider.auth?.jwt) {
			throw Boom.badData('The current plugin for NATS requires a non-expiring JWT to be provided under auth along with the userSeed unless you are using core simple streaming');
		}
		if(provider.masterStream?.enabled === true) {
			if(!provider.masterStream.streamPath) throw Boom.badData('Must provide a stream::subject combination in streamPath for NATS to send master data');
			const test = provider.masterStream.streamPath.split('::');
			if (test.length !== 2) throw Boom.badData('Master data stream path for NATS is in the form "stream::subject"');
		}
	},
	async initializeAG(group, provider) {
		// In the NATS model, we are not initiating anything.
		return {
			group,
			provider
		};
	},
	async publishMaster(group, emit, provider) {
		const nats = n.getInstance();
		const {subject, streamName} = getMasterStreamSub(group, provider.masterStream.streamPath);
		await safePub(nats, emit, subject, streamName, provider);
	},
	async publish(group, emit, provider) {
		const nats = n.getInstance();
		const streamName = provider.clientConfig.stream;
		const subject = provider.clientConfig.subject.replace(/{authGroup}/g, group.id);
		await safePub(nats, emit, subject, streamName, provider);
	},
	async clean() {
		const nats = n.getInstance();
		if(nats.nc) {
			await nats.nc.drain();
		}
	},
	async describe() {
		return {
			name: 'nats',
			startup: true
		};
	},
	async startup(provider) {
		console.info('calling startup');
		let nCheck;
		try {
			nCheck = n.getInstance();
		} catch (e) {
			// do nothing;
		}
		if(!nCheck?.nc) {
			const nats = new Nats(provider);
			return nats.connect();
		}
	}
};

function getMasterStreamSub(groupId, path) {
	const full = path?.split('::');
	if(full?.length !== 2) throw new Error('Master stream is not configured correctly with the path for NATS');
	return {
		streamName: full[0],
		subject: full[1].replace(/{authGroup}/g, groupId)
	};
}

async function pub(nats, emit, subject, streamName) {
	const data = (typeof emit === 'object') ? JSON.stringify(emit) : emit;
	const resp =  await napi.pub(nats, data, subject, streamName);
	if(resp?.seq) {
		await napi.sendBuffer();
	}
	return resp;
}

async function safePub(nats, emit, subject, streamName, provider) {
	try {
		if(process.env.UE_STREAM_EVENTS === 'on' && nats.nc) {
			const result = await pub(nats, emit, subject, streamName, provider);
			if(result?.seq) {
				return result;
			}
		}
		throw Error;
	} catch (e) {
		try {
			console.info('attempting to buffer message for later');
			return napi.bufferMessage(provider, emit, subject, streamName);
		} catch (e) {
			console.error(e.response?.data || e);
		}
		throw new Error('STREAMING REQUESTED BUT IS NOT AVAILABLE - CHECK AG SETTINGS');
	}
}