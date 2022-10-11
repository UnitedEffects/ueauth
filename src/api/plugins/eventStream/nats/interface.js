import Boom from '@hapi/boom';
import { v4 as uuid } from 'uuid';
import NATS from './clientSingleton';


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
		const nats = await NATS.getInstance(provider);
		if(nats.js) {
			const { subject, streamName } = getMasterStreamSub(provider.masterStream.streamPath);
			return pub(nats, emit, subject, streamName);
		}
		throw new Error('NATS NOT OPERATIONAL');
	},
	async publish(group, emit, provider) {
		//todo
		// reset connection on auth expired?
		const nats = await NATS.getInstance(provider);
		if(nats.js) {
			const streamName = provider.clientConfig.stream;
			const subject = provider.clientConfig.subject.replace(/{authGroup}/g, group.id);
			return pub(nats, emit, subject, streamName);
		}
		throw new Error('NATS NOT OPERATIONAL');
	},
	async clean() {
		await NATS.drainInstance();
	}
};

function getMasterStreamSub(groupId, path) {
	const full = path.split('::');
	if(full.length !== 2) throw new Error('Master stream is not configured correctly with the path for NATS');
	return {
		streamName: path[0],
		subject: path[1].replace(/{authGroup}/g, groupId)
	};
}

async function pub(nats, emit, subject, streamName) {
	const data = (typeof emit === 'object') ? JSON.stringify(emit) : emit;
	const options = { msgID: uuid(), expect: { streamName } };
	return nats.js.publish(subject, nats.sc.encode(data), options);
}