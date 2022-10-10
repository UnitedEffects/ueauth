import {connect, credsAuthenticator, StringCodec } from 'nats';
import jwt from 'jsonwebtoken';
import qs from 'querystring';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import cl from '../../../oidc/client/clients';

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

	static async getInstance(provider) {
		if (!NatsClient.instance?.nc) {
			console.info('DEFININIG INSTANCE*********************');
			const connectionSettings = {
				servers: provider.streamUrl,
				debug: true
			};
			if(provider.streamAuth === true) {
				const seed = provider.auth?.userSeed;
				let jwt;
				if(provider.clientConfig.coreSimpleStream !== true) jwt = provider.auth?.jwt;
				else {
					//jwt = await getJwt(provider.auth);
					// todo - switch to other...
					jwt = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJlZDI1NTE5LW5rZXkifQ.eyJleHAiOjE2NjU0NDQ0NDgsIm5hbWUiOiI4ZDJjOGEyYi1jOTFkLTQ3NWItYWYyZS01Yjg0MGE2ZDE0NjQtVUVBdXRoX1Jvb3QgTG9nIEFjY2VzcyAoZGV2KS1uMXhQU1NXRzFvYkhPc1E5SlVzUTkiLCJzdWIiOiJVQk5LUElEU1VBVzdBRlM2S0NQM1JYQVhYMkU2NUVaNDNHNDczSVcyQVVSQ05GRjNTTzVONVBPTiIsIm5hdHMiOnsicHViIjp7ImFsbG93IjpbInVlLnN5cy4qLnVlYXV0aCIsIiRKUy5BUEkuSU5GTyIsIiRKUy5BUEkuU1RSRUFNLk5BTUVTIiwiJEpTLkFQSS5TVFJFQU0uSU5GTy51ZS1zeXN0ZW0iLCIkSlMuQVBJLlNUUkVBTS5NU0cuR0VULnVlLXN5c3RlbSIsIiRKUy5BUEkuQ09OU1VNRVIuTkFNRVMudWUtc3lzdGVtIiwiJEpTLkFDSy51ZS1zeXN0ZW0uUkVTRVJWRURfQ09OU1VNRVJfVUVBdXRoUm9vdC0wX1VFLVNZU1RFTV9GNXJKRG9NTEVVLj4iLCIkSlMuQVBJLkNPTlNVTUVSLklORk8udWUtc3lzdGVtLlJFU0VSVkVEX0NPTlNVTUVSX1VFQXV0aFJvb3QtMF9VRS1TWVNURU1fRjVySkRvTUxFVSIsIiRKUy5BUEkuQ09OU1VNRVIuTVNHLk5FWFQudWUtc3lzdGVtLlJFU0VSVkVEX0NPTlNVTUVSX1VFQXV0aFJvb3QtMF9VRS1TWVNURU1fRjVySkRvTUxFVSIsIiRKUy5BUEkuQ09OU1VNRVIuRFVSQUJMRS5DUkVBVEUudWUtc3lzdGVtLlJFU0VSVkVEX0NPTlNVTUVSX1VFQXV0aFJvb3QtMF9VRS1TWVNURU1fRjVySkRvTUxFVSIsIiRKUy5BUEkuQ09OU1VNRVIuREVMRVRFLnVlLXN5c3RlbS5SRVNFUlZFRF9DT05TVU1FUl9VRUF1dGhSb290LTBfVUUtU1lTVEVNX0Y1ckpEb01MRVUiLCIkSlMuQUNLLnVlLXN5c3RlbS5SRVNFUlZFRF9DT05TVU1FUl9VRUF1dGhSb290LTFfVUUtU1lTVEVNX2VnWkRYa1h0dHcuPiIsIiRKUy5BUEkuQ09OU1VNRVIuSU5GTy51ZS1zeXN0ZW0uUkVTRVJWRURfQ09OU1VNRVJfVUVBdXRoUm9vdC0xX1VFLVNZU1RFTV9lZ1pEWGtYdHR3IiwiJEpTLkFQSS5DT05TVU1FUi5NU0cuTkVYVC51ZS1zeXN0ZW0uUkVTRVJWRURfQ09OU1VNRVJfVUVBdXRoUm9vdC0xX1VFLVNZU1RFTV9lZ1pEWGtYdHR3IiwiJEpTLkFQSS5DT05TVU1FUi5EVVJBQkxFLkNSRUFURS51ZS1zeXN0ZW0uUkVTRVJWRURfQ09OU1VNRVJfVUVBdXRoUm9vdC0xX1VFLVNZU1RFTV9lZ1pEWGtYdHR3IiwiJEpTLkFQSS5DT05TVU1FUi5ERUxFVEUudWUtc3lzdGVtLlJFU0VSVkVEX0NPTlNVTUVSX1VFQXV0aFJvb3QtMV9VRS1TWVNURU1fZWdaRFhrWHR0dyJdLCJkZW55IjpbIiRTWVMuPiIsIl9JTkJPWC4-Il19LCJzdWIiOnsiYWxsb3ciOlsidWUuc3lzLioudWVhdXRoIiwiX0lOQk9YX3VlLXN5c3RlbV94ZHd2YWFBdVhZLj4iXSwiZGVueSI6WyIkU1lTLj4iLCJfSU5CT1guPiJdfSwicmVzcCI6eyJtYXgiOjF9LCJiZWFyZXJfdG9rZW4iOmZhbHNlLCJhbGxvd19yZXNwb25zZXMiOnRydWUsImlzc3Vlcl9hY2NvdW50IjoiQUQzRDZaSTM2T0dXNU5JRlhLS1hUUUtHTkJaTUVNWk5UUExHTE5FVlU2VjNZUU1UM0pLUVdLNEciLCJ0eXBlIjoidXNlciIsInZlcnNpb24iOjJ9LCJhdWQiOiJOQVRTIiwiaXNzIjoiQURHQ05FRzJYVVVDQzNNMzZENzVQSlJWRUtUREhNN0VNUFpWVERUUlNLRUZHNENPMkJBRVhHVEgiLCJpYXQiOjE2NjU0NDA4NDksImp0aSI6Imc5NGhHSEtWYnFyZURETDIifQ.6k6FneKjy4b0y8bvHKQ8zs3G6geze3NZhRo0uH0B5_jfKOBTnu0lV0ELS7MJAK5MvYn4q34Ug0mukbVU4ATXCA';
				}
				if(!seed) throw new Error('Authorization not configured for NATS');
				if(!jwt) throw new Error('Authorization not configured for NATS');
				connectionSettings.authenticator = credsAuthenticator(new TextEncoder().encode(credentials(seed, jwt)));
			}
			if(provider.clientConfig?.inbox) {
				connectionSettings.inboxPrefix = provider.clientConfig.inbox;
			}
			console.info(connectionSettings);
			const nc = await connect(connectionSettings);
			console.info('NATS CONNECTED');
			const js = await nc.jetstream();
			const sc = StringCodec();
			NatsClient.instance = {nc, js, sc};
		} else console.info('FOUND INSTANCE****************************');
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
		if(!settings) throw new Error('NATS configuration requires streamAuth');
		const url = settings.jwtIssuer;
		const clientId = settings.clientId;
		const userPublicKey = settings.userPublicKey;
		const expires = settings.expires || 36000;
		const group = settings.authGroup;
		const client = cl.getOneByAgId(group, clientId);
		if(!client) throw new Error(`Could not authorize nats - Core Client ${clientId} not found`);
		console.info(client); //todo delete this...
		const secret = client.payload?.client_secret;
		if(!secret) throw new Error('Could not find the client secret');
		const token = await getCC(group, url, clientId, secret);
		console.info(token); //todo delete
		const options = {
			method: 'post',
			url: `${url}/${group}/shared/simple/access-op/jwt`,
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
		console.info(options); //todo delete
		const result = await axios(options);
		if(!result?.data?.data?.jwt) throw new Error('Unable to get a NATS user jwt');
		console.info(result.data);
		return result.data.data.jwt;
	} catch (error) {
		console.error(error);
		throw error;
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
		const jwt = await getSecretJwt(url, id, secret, aud);
		console.info('secret JWT');
		console.info(jwt); //todo delete
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
				audience: `${issuer}/${group}`,
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