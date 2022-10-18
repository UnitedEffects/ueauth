import config from '../../../../config';
import {connect, credsAuthenticator, StringCodec} from 'nats';
import {v4 as uuid} from 'uuid';
import cache from './cache/cache';
import cl from '../../../oidc/client/clients';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import qs from 'querystring';

const CACHE_NAME = 'NATS';
const CACHE_KEY = 'nats-jwt';
const CACHE_CLIENT_SECRET_KEY = 'nats-client-secret';
const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

export default {
	async pushOneMessage(provider, data, subject, streamName) {
		let nc, jwt;
		try {
			const connectionSettings = {
				servers: provider.streamUrl,
				debug: (config.ENV !== 'production')
			};
			if(provider.clientConfig?.inbox) {
				connectionSettings.inboxPrefix = provider.clientConfig.inbox;
			}
			if(provider.streamAuth === true) {
				const seed = provider.auth?.userSeed;
				if(provider.clientConfig.coreSimpleStream !== true) jwt = provider.auth?.jwt;
				else {
					jwt = await getJwt(provider.auth);
				}
				connectionSettings.authenticator = credsAuthenticator(new TextEncoder().encode(credentials(seed, jwt)));
			}
			nc = await connect(connectionSettings);
			const js = await nc.jetstream();
			const sc = StringCodec();
			const msg = (typeof data === 'object') ? JSON.stringify(data) : data;
			const options = { msgID: uuid(), expect: { streamName } };
			await js.publish(subject, sc.encode(msg), options);
			await nc.drain();
		} catch (error) {
			if(nc) await nc.drain();
			throw error;
		}
	}
};

function credentials(seed, jwt) {
	return `-----BEGIN NATS USER JWT-----
    ${jwt}
  ------END NATS USER JWT------
************************* IMPORTANT *************************
  NKEY Seed printed below can be used sign and prove identity.
  NKEYs are sensitive and should be treated as secrets.
  -----BEGIN USER NKEY SEED-----
    ${seed}
  ------END USER NKEY SEED------
`;
}

async function getJwt(settings) {
	try {
		let uJwt = await cache.find(CACHE_NAME, CACHE_KEY);
		if(uJwt) return uJwt;
		if(!settings) throw new Error('NATS configuration requires streamAuth');
		const url = settings.jwtIssuer;
		const clientId = settings.clientId;
		const userPublicKey = settings.userPublicKey;
		const expires = settings.expires || 3600;
		const group = settings.authGroup;
		let secret = await cache.find(CACHE_NAME, CACHE_KEY, CACHE_CLIENT_SECRET_KEY);
		if(!secret) {
			const c = await cl.getOneByAgId(group, clientId);
			if(!c) throw new Error(`Could not authorize nats - Core Client ${clientId} not found`);
			const client = JSON.parse(JSON.stringify(c));
			if(client?.payload?.client_secret) {
				secret = client.payload?.client_secret;
				if(!secret) throw new Error('Could not find the client secret');
				await cache.set(CACHE_NAME, CACHE_CLIENT_SECRET_KEY, secret);
			}
		}
		const token = await getCC(group, url, clientId, secret);
		if(!token) throw new Error('Unable to get a token');
		const options = {
			method: 'post',
			url: `${url}/api/${group}/shared/simple/access-op/jwt`,
			headers: {
				'content-type': 'application/json',
				'authorization': `bearer ${token}`
			},
			data: {
				publicKey: userPublicKey,
				coreClientId: clientId,
				expires
			}
		};
		const result = await axios(options);
		if(!result?.data?.data?.jwt) throw new Error('Unable to get a NATS user jwt');
		await cache.set(CACHE_NAME, CACHE_KEY, result.data.data.jwt);
		return result.data.data.jwt;
	} catch (error) {
		console.error(error?.response?.data || error);
		return undefined;
	}
}

async function getSecretJwt(id, secret, aud, minutes = 1) {
	const clientSecret = secret;
	const clientId = id;

	const claims = {
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now()/1000 + (minutes*60)),
		iss: clientId,
		aud,
		sub: clientId,
		jti: uuid()
	};

	return jwt.sign(claims, clientSecret);
}

async function getCC(group, issuer, id, secret) {
	try {
		const url = `${config.PROTOCOL}://${config.SWAGGER}/${group}/token`;
		const aud = `${config.PROTOCOL}://${config.SWAGGER}/${group}`;
		// below is for local debug only
		//const url = `https://qa.uecore.io/${group}/token`;
		//const aud = `https://qa.uecore.io/${group}`;

		const jwt = await getSecretJwt(id, secret, aud);
		const options = {
			method: 'post',
			url,
			headers: {
				'content-type': 'application/x-www-form-urlencoded'
			},
			data: qs.stringify({
				grant_type: 'client_credentials',
				client_assertion_type: CLIENT_ASSERTION_TYPE,
				client_assertion: jwt,
				audience: `${issuer}/api/${group}`,
				scope: 'access'
			})
		};
		const data = await axios(options);
		return data?.data?.access_token;
	} catch (error) {
		if(error.isAxiosError) console.error(error?.response?.data);
		else console.error(error);
		return undefined;
	}
}