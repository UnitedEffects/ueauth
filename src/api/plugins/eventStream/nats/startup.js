import {connect, credsAuthenticator, StringCodec} from 'nats';
import cache from './cache/cache';
import n from './cache/nats';
import napi from './nats';
import cl from '../../../oidc/client/clients';
const config = require('../../../../config');

const { CACHE_NAME, NATS_CACHE_KEY, NATS_CACHE_CLIENT_SECRET_KEY } = napi.keys();
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
		this.debug = (config.ENV !== 'production');
	}
	async connect() {
		try {
			await cache.clear(CACHE_NAME, NATS_CACHE_KEY);
			n.clearInstance();
			if(this.nc) await this.nc.close();
			this.natsCSecret = await cache.find(CACHE_NAME, NATS_CACHE_CLIENT_SECRET_KEY);
			if(!this.natsCSecret) {
				const c = await cl.getOneByAgId(this.group, this.natsCId);
				if(!c) throw new Error(`Could not authorize nats - Core Client ${this.natsCId} not found`);
				const client = JSON.parse(JSON.stringify(c));
				if(client?.payload?.client_secret) {
					this.natsCSecret = client.payload?.client_secret;
					if(!this.natsCSecret) throw new Error('Could not find the client secret');
					await cache.set(CACHE_NAME, NATS_CACHE_CLIENT_SECRET_KEY, this.natsCSecret);
				}
			}
			//todo configurations to allow non-auth...
			this.jwt = await this.getJwt();
			console.info('jwt', this.jwt);
			this.creds = napi.credentials(this.seed, this.jwt);
			console.info('creds', this.creds);
			this.nc = await connect({ name: `ueauth-${config.ENV}-${config.VERSION}`, servers: this.nats, authenticator: credsAuthenticator(new TextEncoder().encode(this.creds)), inboxPrefix: this.inbox, debug: this.debug });
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
						console.info(`Trying startup nats connection again - ${this.count}`);
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
			let uJwt = await cache.find(CACHE_NAME, NATS_CACHE_KEY);
			if(uJwt) return uJwt;
			const url = this.natsJwtIssuer;
			console.info('url', url);
			const clientId = this.natsCId;
			console.info('Client Id', clientId);
			const userPublicKey = this.upk;
			const expires = 86400;
			const group = this.group;
			console.info('group', group);
			const secret = this.natsCSecret;
			const result = await napi.callJWTIssuer(group, url, clientId, secret, userPublicKey, expires);
			if(!result?.data?.data?.jwt) throw new Error('Unable to get a NATS user jwt');
			await cache.set(CACHE_NAME, NATS_CACHE_KEY, result.data.data.jwt, expires);
			return result.data.data.jwt;
		} catch (error) {
			console.info('error getting jwt');
			console.error(error?.response?.data || error);
			throw error;
		}
	}
}

export default NatsConnector;