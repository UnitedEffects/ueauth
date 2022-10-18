import {connect, credsAuthenticator, StringCodec} from 'nats';
import axios from 'axios';
import { v4 as uuid } from 'uuid';
import JWT from 'jsonwebtoken';
import qs from 'querystring';
import cache from './cache/cache';
import n from './cache/nats';
import cl from '../../../oidc/client/clients';
const config = require('../../../../config');

const CACHE_NAME = 'NATS';
const CACHE_KEY = 'nats-jwt';
const CACHE_CLIENT_SECRET_KEY = 'nats-client-secret';
const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
const sc = StringCodec();

class NatsConnector {
	constructor(provider) {
		this.group = provider.auth?.authGroup;
		this.nats = provider.streamUrl;
		this.seed = provider.auth?.userSeed;
		this.upk = provider.auth?.userPublicKey;
		this.inbox = provider.clientConfig?.inbox;
		this.natsJwtIssuer = provider.auth?.jwtIssuer;
		this.natsCId = provider.auth?.clientId;
		this.stream = provider.clientConfig.stream;
		this.count = 0;
		this.debug = true; //(config.ENV !== 'production');
	}
	async connect() {
		try {
			await cache.clear(CACHE_NAME, CACHE_KEY);
			n.clearInstance();
			if(this.nc) await this.nc.close();
			this.natsCSecret = await cache.find(CACHE_NAME, CACHE_CLIENT_SECRET_KEY);
			if(!this.natsCSecret) {
				const c = await cl.getOneByAgId(this.group, this.natsCId);
				if(!c) throw new Error(`Could not authorize nats - Core Client ${this.natsCId} not found`);
				const client = JSON.parse(JSON.stringify(c));
				if(client?.payload?.client_secret) {
					this.natsCSecret = client.payload?.client_secret;
					if(!this.natsCSecret) throw new Error('Could not find the client secret');
					await cache.set(CACHE_NAME, CACHE_CLIENT_SECRET_KEY, this.natsCSecret);
				}
			}
			//todo configurations to allow non-auth...
			this.jwt = await this.getJwt();
			this.creds = creds(this.seed, this.jwt);
			this.nc = await connect({ name: 'ueauth', servers: this.nats, authenticator: credsAuthenticator(new TextEncoder().encode(this.creds)), inboxPrefix: this.inbox, debug: this.debug });
			this.js = await this.nc.jetstream();
			this.jsm = await this.nc.jetstreamManager();
			await this.jsm.streams.info(this.stream);
			n.setInstance({
				nc: this.nc,
				js: this.js,
				sc
			});
			(async () => {
				for await (const s of this.nc.status()) {
					switch (s.data) {
					case 'AUTHORIZATION_VIOLATION':
					case 'AUTHENTICATION_EXPIRED':
						await this.connect();
						break;
					default:
					}
				}
			})().then();
		} catch (error) {
			if(this.nc) await this.nc.close();
			if(!this.nc) {
				console.info('THERE WAS A PROBLEM CONNECTING TO NATS - SETTING UP RETRY FOR 20 ATTEMPTS');
				setTimeout(async () => {
					if(this.count < 20) {
						console.info(`Trying again - ${this.count}`);
						this.count = this.count + 1;
						await this.connect();
					} else console.info('20 attempts failed, giving up until restart');
				}, 5000);
			}
			console.error(`HTTP REQUEST ERROR: ${error.isAxiosError}`, error?.response?.data || error);
			throw new Error('Could not initiate connection - check NATS configurations');
		}
	}
	async getJwt() {
		try {
			let uJwt = await cache.find(CACHE_NAME, CACHE_KEY);
			if(uJwt) return uJwt;
			const url = this.natsJwtIssuer;
			const clientId = this.natsCId;
			const userPublicKey = this.upk;
			const expires = 3600;
			const group = this.group;
			const secret = this.natsCSecret;
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
			await cache.set(CACHE_NAME, CACHE_KEY, result.data.data.jwt, expires);
			return result.data.data.jwt;
		} catch (error) {
			console.error(error?.response?.data || error);
			throw error;
		}
	}
}

function creds(seed, jwt) {
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

async function getSecretJwt(id, secret, aud, minutes = 1) {
	const clientSecret = secret;
	const clientId = id;

	const claims = {
		iat: Math.floor(Date.now()/1000),
		exp: Math.floor(Date.now()/1000 + (minutes*60)),
		iss: clientId,
		aud,
		sub: clientId,
		jti: uuid()
	};

	return JWT.sign(claims, clientSecret);
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
		throw error;
	}
}

export default NatsConnector;