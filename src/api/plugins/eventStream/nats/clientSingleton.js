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

	static creds(seed, jwt) {
		return credentials(seed, jwt);
	}

	static async getInstance(provider) {
		if (!NatsClient.instance) {
			const connectionSettings = {
				servers: provider.streamUrl,
				debug: true
			};
			if(provider.clientConfig?.inbox) {
				connectionSettings.inboxPrefix = provider.clientConfig.inbox;
			}
			let nc, js;
			let go = true;
			if(provider.streamAuth === true) {
				go = false;
				const seed = provider.auth?.userSeed;
				let jwt;
				if(provider.clientConfig.coreSimpleStream !== true) jwt = provider.auth?.jwt;
				else {
					// todo - getJwt will not work locally...
					// jwt = await getJwt(provider.auth); //todo cache...
					// todo - switch to other...
					jwt = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJlZDI1NTE5LW5rZXkifQ.eyJleHAiOjE2NjU1NDA2MTIsIm5hbWUiOiI4ZDJjOGEyYi1jOTFkLTQ3NWItYWYyZS01Yjg0MGE2ZDE0NjQtVUVBdXRoX1Jvb3QgTG9nIEFjY2VzcyAoZGV2KS1uMXhQU1NXRzFvYkhPc1E5SlVzUTkiLCJzdWIiOiJVQk5LUElEU1VBVzdBRlM2S0NQM1JYQVhYMkU2NUVaNDNHNDczSVcyQVVSQ05GRjNTTzVONVBPTiIsIm5hdHMiOnsiZGF0YSI6LTEsInBheWxvYWQiOi0xLCJzdWJzIjotMSwic3JjIjpbXSwidGltZXMiOltdLCJsb2NhbGUiOiIiLCJwdWIiOnsiYWxsb3ciOlsidWUuc3lzLioudWVhdXRoIiwiJEpTLkFQSS5JTkZPIiwiJEpTLkFQSS5TVFJFQU0uTkFNRVMiLCIkSlMuQVBJLlNUUkVBTS5JTkZPLnVlLXN5c3RlbSIsIiRKUy5BUEkuU1RSRUFNLk1TRy5HRVQudWUtc3lzdGVtIiwiJEpTLkFQSS5DT05TVU1FUi5OQU1FUy51ZS1zeXN0ZW0iLCIkSlMuQUNLLnVlLXN5c3RlbS5SRVNFUlZFRF9DT05TVU1FUl9VRUF1dGhSb290LTBfVUUtU1lTVEVNX0Y1ckpEb01MRVUuPiIsIiRKUy5BUEkuQ09OU1VNRVIuSU5GTy51ZS1zeXN0ZW0uUkVTRVJWRURfQ09OU1VNRVJfVUVBdXRoUm9vdC0wX1VFLVNZU1RFTV9GNXJKRG9NTEVVIiwiJEpTLkFQSS5DT05TVU1FUi5NU0cuTkVYVC51ZS1zeXN0ZW0uUkVTRVJWRURfQ09OU1VNRVJfVUVBdXRoUm9vdC0wX1VFLVNZU1RFTV9GNXJKRG9NTEVVIiwiJEpTLkFQSS5DT05TVU1FUi5EVVJBQkxFLkNSRUFURS51ZS1zeXN0ZW0uUkVTRVJWRURfQ09OU1VNRVJfVUVBdXRoUm9vdC0wX1VFLVNZU1RFTV9GNXJKRG9NTEVVIiwiJEpTLkFQSS5DT05TVU1FUi5ERUxFVEUudWUtc3lzdGVtLlJFU0VSVkVEX0NPTlNVTUVSX1VFQXV0aFJvb3QtMF9VRS1TWVNURU1fRjVySkRvTUxFVSIsIiRKUy5BQ0sudWUtc3lzdGVtLlJFU0VSVkVEX0NPTlNVTUVSX1VFQXV0aFJvb3QtMV9VRS1TWVNURU1fZWdaRFhrWHR0dy4-IiwiJEpTLkFQSS5DT05TVU1FUi5JTkZPLnVlLXN5c3RlbS5SRVNFUlZFRF9DT05TVU1FUl9VRUF1dGhSb290LTFfVUUtU1lTVEVNX2VnWkRYa1h0dHciLCIkSlMuQVBJLkNPTlNVTUVSLk1TRy5ORVhULnVlLXN5c3RlbS5SRVNFUlZFRF9DT05TVU1FUl9VRUF1dGhSb290LTFfVUUtU1lTVEVNX2VnWkRYa1h0dHciLCIkSlMuQVBJLkNPTlNVTUVSLkRVUkFCTEUuQ1JFQVRFLnVlLXN5c3RlbS5SRVNFUlZFRF9DT05TVU1FUl9VRUF1dGhSb290LTFfVUUtU1lTVEVNX2VnWkRYa1h0dHciLCIkSlMuQVBJLkNPTlNVTUVSLkRFTEVURS51ZS1zeXN0ZW0uUkVTRVJWRURfQ09OU1VNRVJfVUVBdXRoUm9vdC0xX1VFLVNZU1RFTV9lZ1pEWGtYdHR3Il0sImRlbnkiOlsiJFNZUy4-IiwiX0lOQk9YLj4iXX0sInN1YiI6eyJhbGxvdyI6WyJ1ZS5zeXMuKi51ZWF1dGgiLCJfSU5CT1hfdWUtc3lzdGVtX3hkd3ZhYUF1WFkuPiJdLCJkZW55IjpbIiRTWVMuPiIsIl9JTkJPWC4-Il19LCJyZXNwIjp7Im1heCI6MTAwfSwiYmVhcmVyX3Rva2VuIjpmYWxzZSwiYWxsb3dlZF9jb25uZWN0aW9uX3R5cGVzIjpbXSwiYWxsb3dfcmVzcG9uc2VzIjp0cnVlLCJpc3N1ZXJfYWNjb3VudCI6IkFEM0Q2WkkzNk9HVzVOSUZYS0tYVFFLR05CWk1FTVpOVFBMR0xORVZVNlYzWVFNVDNKS1FXSzRHIiwidHlwZSI6InVzZXIiLCJ2ZXJzaW9uIjoyfSwiYXVkIjoiTkFUUyIsImlzcyI6IkFER0NORUcyWFVVQ0MzTTM2RDc1UEpSVkVLVERITTdFTVBaVlREVFJTS0VGRzRDTzJCQUVYR1RIIiwiaWF0IjoxNjY1NTA0NjEyLCJqdGkiOiIxYmJkY0ZzS08wYVZmQitYIn0.T-uAiPJ3KUFE0ErULemgZT7XHXTCSRtiYigDFp40ieHdkRZKfdfBz80h9gk6ydAwKOfhnbx7glPhscZwep-WBQ';
				}
				connectionSettings.authenticator = credsAuthenticator(new TextEncoder().encode(credentials(seed, jwt)));
				if(jwt && seed) {
					go = true;
				}
			}

			if(go === true) {
				nc = await connect(connectionSettings);
				js = await nc.jetstream();
			}

			const sc = StringCodec();
			//todo
			// cache this and set it to reset after 5 min if its not set...
			// figure out expired connections...
			if(nc) NatsClient.instance = {nc, js, sc};
			else NatsClient.instance = 'NOT OPERATIONAL';
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
		if(!settings) throw new Error('NATS configuration requires streamAuth');
		const url = settings.jwtIssuer;
		const clientId = settings.clientId;
		const userPublicKey = settings.userPublicKey;
		const expires = settings.expires || 36000;
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