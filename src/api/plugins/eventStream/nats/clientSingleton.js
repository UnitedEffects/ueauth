import {connect, credsAuthenticator, StringCodec } from 'nats';
import jwt from 'jsonwebtoken';
import qs from 'querystring';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import cl from '../../../oidc/client/clients';
import cache from './cache';

const config = require('../../../../config');

const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

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

class NatsClient {
	constructor() {
		throw new Error('Use NatsClient.getInstance()');
	}

	static creds(seed, jwt) {
		return credentials(seed, jwt);
	}

	static async pushOneMessage(provider, data, subject, streamName) {
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

	static async setInstance(provider) {
		if(NatsClient.instance.nc) NatsClient.instance.nc.close();
		await cache.clearJwt();
		const connectionSettings = {
			servers: provider.streamUrl,
			debug: (config.ENV !== 'production')
		};
		if(provider.clientConfig?.inbox) {
			connectionSettings.inboxPrefix = provider.clientConfig.inbox;
		}
		let nc, js, jwt;
		if(provider.streamAuth === true) {
			const seed = provider.auth?.userSeed;
			if(provider.clientConfig.coreSimpleStream !== true) jwt = provider.auth?.jwt;
			else {
				jwt = await getJwt(provider.auth);
			}
			connectionSettings.authenticator = credsAuthenticator(new TextEncoder().encode(credentials(seed, jwt)));
		}
		try {
			nc = await connect(connectionSettings);
			js = await nc.jetstream();
		} catch(e) {
			console.error(e);
		}
		if(nc) {
			(async (provider) => {
				for await (const s of nc.status()) {
					switch (s.data) {
					case 'AUTHORIZATION_VIOLATION':
					case 'AUTHENTICATION_EXPIRED':
						await this.setInstance(provider);
						break;
					default:
					}
				}
			})(provider).then();
		}
		const sc = StringCodec();
		if(nc) NatsClient.instance = {nc, js, sc};
		return NatsClient.instance;
	}

	static resetInstance(resetCount = false) {
		if(resetCount === true) cache.resetCount();
		if(NatsClient.instance.nc) NatsClient.instance.nc.close();
		delete NatsClient.instance;
	}

	static async getInstance(provider, failover = undefined) {
		if (!NatsClient.instance) {
			NatsClient.instance = 'NOT OPERATIONAL';
			if(failover) {
				this.pushOneMessage(provider, failover.data, failover.subject, failover.streamName);
			}
			let i = await cache.count();
			const base = 10000;
			if(i < 15) {
				console.info(`resetting after ${(i*base)/1000} seconds to attempt nats connection again`);
				setTimeout(async () => {
					console.info('checking...');
					if(NatsClient.instance === 'NOT OPERATIONAL') {
						console.info('killing instance to try again...');
						this.resetInstance();
					}
				}, i*base);
			} else {
				console.error(`COULD NOT ESTABLISH A NATS CONNECTION - GIVING UP AFTER ${i} ATTEMPTS`);
				console.error('************************************');
				console.info(JSON.stringify(provider, null, 2));
			}
			// async call to try and set it...
			this.setInstance(provider);
		}
		return NatsClient.instance;
	}
	
	static drainInstance() {
		if (NatsClient.instance) {
			(async() => {
				await NatsClient.instance.nc.drain();
			})();
		}
	}
}

async function getJwt(settings) {
	try {
		let uJwt = await cache.findJwt();
		if(uJwt) return uJwt;
		if(!settings) throw new Error('NATS configuration requires streamAuth');
		const url = settings.jwtIssuer;
		const clientId = settings.clientId;
		const userPublicKey = settings.userPublicKey;
		const expires = settings.expires || 3600;
		const group = settings.authGroup;
		const c = await cl.getOneByAgId(group, clientId);
		if(!c) throw new Error(`Could not authorize nats - Core Client ${clientId} not found`);
		const client = JSON.parse(JSON.stringify(c));
		const secret = client.payload?.client_secret;
		if(!secret) throw new Error('Could not find the client secret');
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
		await cache.setJwt(result.data.data.jwt);
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
		// const url = `https://qa.uecore.io/${group}/token`;
		// const aud = `https://qa.uecore.io/${group}`;

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


export default NatsClient;