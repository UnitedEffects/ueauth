import oidc from '../api/oidc/oidc';
import cl from '../api/oidc/client/clients';
import Boom from '@hapi/boom';
import iat from '../api/oidc/initialAccess/iat';
import account from '../api/accounts/account';
import group from '../api/authGroup/group';

const config = require('../config');

const core = {
	async getUser(authGroup, decoded, token, aliasDns = undefined) {
		/**
         * We look up the user from the DB directly rather than going through an OIDC http request since this is an internal
         * lookup and this is the system of record. Additionally, since this is to authorize access to this service itself, we
         * don't worry about scopes - we can access that data at anytime anyway.
         */
		const userRecord = await oidc(authGroup, aliasDns).Account.findAccount({authGroup}, decoded.sub, token);
		if(!userRecord) return undefined;
		return await userRecord.claims();
	},
	async getClient(authGroup, id) {
		/**
         * When client credential token comes, we look up the client itself
         */
		return cl.getOne(authGroup, id);
	},
	async introspect(token, authGroup, aliasDns = undefined) {
		/**
         * Looking up the token directly for decoding since this is the system of record.
         * External systems would make an http request to the
         * introspect endpoint.
         * @type {AccessToken}
         */
		const provider = oidc(authGroup, aliasDns);
		let accessToken = await provider.AccessToken.find(token);
		if(!accessToken) {
			// try client-credentials
			accessToken = await provider.ClientCredentials.find(token);
		}
		if(!accessToken) return null;
		let result = {
			active: (accessToken.iat < accessToken.exp),
			iss: provider.issuer,
			sub: accessToken.accountId || accessToken.clientId,
			client_id: accessToken.clientId,
			exp: accessToken.exp,
			iat: accessToken.iat,
			jti: accessToken.jti,
			scope: accessToken.scope,
			token_type: 'Bearer'
		};
		if (accessToken.aud) result.aud = accessToken.aud;
		if (accessToken.extra) {
			result = { ...result, ...accessToken.extra};
			if (accessToken.extra.group) {
				const iss = result.iss.split('/');
				iss[iss.length-1] = accessToken.extra.group;
				result.iss = iss.join('/');
			}
		}
		//console.info(accessToken);
		//console.info(result);
		return result;
	},
	async runDecodedChecks(token, issuer, decoded, authGroup, externalValidation = false, customDomain = undefined) {
		let cl;
		let client;
		if(decoded.nonce) {
			// check its not id-token
			throw Boom.unauthorized('ID Tokens can not be used for API Access');
		}
		if(!issuer.includes(decoded.iss)) {
			// check iss
			throw Boom.unauthorized('Token issuer not recognized');
		}
		if(!decoded.group) {
			//check auth group exists
			throw Boom.unauthorized('No Auth Group detected in token');
		}
		if(decoded.group !== authGroup._id) {
			// check auth group matches
			throw Boom.unauthorized('Auth Group does not match');
		}
		if (externalValidation === false) {
			if(typeof decoded.aud === 'string') {
				if(!issuer.includes(decoded.aud)) {
					// check audience = client
					throw Boom.unauthorized('Token audience not specific to this auth group client');
				}
			}
			if(Array.isArray(decoded.aud)) {
				let found = false;
				for(let i=0; i<decoded.aud.length; i++) {
					if(issuer.includes(decoded.aud[i])) found = true;
				}
				if(found === false) {
					// check audience = client
					throw Boom.unauthorized('Token audience not specific to this auth group client');
				}
			}
			if (decoded.client_id) {
				if(decoded.sub && decoded.sub !== decoded.client_id) {
					// this is an access token and we expect users to only use the associatedClient
					// otherwise we will let the client check further below validate
					if(decoded.client_id !== authGroup.associatedClient) {
						//throw Boom.unauthorized('Access Token client ID not specific to this auth group client');
						if(!cl) cl = await core.getClient(authGroup, decoded.client_id);
						if(!cl) throw Boom.unauthorized('Client not found');
						client = JSON.parse(JSON.stringify(cl));
						if (!client) throw Boom.unauthorized('Client not recognized');
						if(!client.auth_group && client.auth_group !== decoded.group) {
							throw Boom.unauthorized('Client not associated with indicated auth group');
						}
					}
				}

			}
			if(decoded.azp) {
				// client credential issuing client - azp
				if(decoded.sub && decoded.sub !== decoded.azp) {
					// this is an access token and we expect users to only use the associatedClient
					// otherwise we will let the client check further below validate
					if(decoded.azp !== authGroup.associatedClient) {
						throw Boom.unauthorized('Access Token client ID not specific to this auth group client');
					}
				}
			}
		}
		//check sub if present
		if(decoded.sub && decoded.client_id !== decoded.sub) {
			const user = await core.getUser(authGroup, decoded, token, customDomain);
			if(!user) throw Boom.unauthorized('User not recognized');
			// Check auth group
			if (!user.group && user.group !== decoded.group) {
				throw Boom.unauthorized('User not associated with indicated auth group');
			}
			return { ...user, decoded, subject_group: authGroup };
		}
		// client_credential - note, permissions may still stop the request
		if((decoded.client_id === decoded.sub) || (!decoded.sub && decoded.client_id)) {
			if(!cl) cl = await core.getClient(authGroup, decoded.sub || decoded.client_id);
			if(!cl) throw Boom.unauthorized('Client not found');
			client = JSON.parse(JSON.stringify(cl));
			if (!client) throw Boom.unauthorized('Client not recognized');
			if(!client.auth_group && client.auth_group !== decoded.group) {
				throw Boom.unauthorized('Client not associated with indicated auth group');
			}
			const out = {
				client_credential: true,
				sub: client.client_id,
				client_id: client.client_id,
				client_name: client.client_name,
				application_type: client.application_type,
				subject_type: client.subject_type,
				require_auth_time: client.require_auth_time,
				auth_group: client.auth_group
			};
			return { ...out, decoded, subject_group: authGroup };
		}

		return decoded;
	},
	async whitelist(req, res, next) {
		try {
			let whiteList = config.UI_WHITE_LIST();
			if(!Array.isArray(whiteList)) whiteList = [];
			if(req.authGroup?.aliasDnsUi) {
				whiteList.push(req.authGroup.aliasDnsUi);
			}
			if(req.authGroup?.aliasDnsOIDC) {
				whiteList.push(req.authGroup.aliasDnsOIDC);
			}
			/* todo - bring this back
			if(config.ENV !== 'dev'){
				if(whiteList.includes(req.hostname) && req.secure) return next();
			} else {
				if(whiteList.includes(req.hostname)) return next();
			}
			 */
			if(whiteList.includes(req.hostname)) return next();
			throw Boom.unauthorized();
		} catch (error) {
			next(error);
		}
	},
	async iatQueryCodeAuth (req, res, next) {
		try {
			if(!req.query.code) throw Boom.unauthorized();
			if (!req.authGroup) throw Boom.preconditionFailed('Auth Group not recognized');
			const token = req.query.code;
			const access = await iat.getOne(token, req.authGroup.id);
			if(!access?.payload) throw Boom.unauthorized();
			const payload = JSON.parse(JSON.stringify(access.payload));
			if(payload?.kind !== 'InitialAccessToken') throw Boom.unauthorized();
			const user = await account.getAccount(req.authGroup.id, payload.sub);
			if(!user) throw Boom.unauthorized();
			if(user.email !== payload.email) {
				console.error('Query IAT email mismatch');
				throw Boom.unauthorized();
			}
			if(user.authGroup !== payload.auth_group) {
				console.error('Query IAT authGroup mismatch');
				throw Boom.unauthorized();
			}
			if(user.authGroup !== req.authGroup.id) {
				console.error('Query IAT authGroup Request mismatch');
				throw Boom.unauthorized();
			}
			const subject = JSON.parse(JSON.stringify(user));
			subject.sub = subject.id;
			req.user = { ...subject, decoded: payload, subject_group: req.authGroup };
			req.token = token;
			try {
				//attempt to clear iat and log the user out of other sessions but don't get hung up
				await iat.deleteOne(access._id, req.authGroup.id);
			} catch (e) {
				console.error('check to make sure initial access tokens are deleting once used and that the user does not have active sessions');
				console.error(e);
			}
			return next();
		} catch (error) {
			// Assumes this is only ever used for Browser based requests
			console.error(error);
			const { authGroup, safeAG } = await group.safeAuthGroup(req.authGroup);
			let user;
			if(req.query.user) {
				try {
					user = await account.getAccount(req.authGroup, req.query.user, true);
					await account.resetOrVerify(req.authGroup, req.globalSettings, user,[], (req.user) ? req.user.sub : undefined, false, req.customDomain);
				} catch (error) {
					// do nothing
				}
			}
			return res.render('response/response', {
				title: 'Uh oh...',
				message: (user) ? 'Invalid or expired Link. Sending a new one. Check your email.' : 'Invalid Verify Account Link',
				details: `This page requires special access. ${(user) ? 'Your account link may have expired. We are attempting to send you a fresh link. Check your email. If you continue to have issues, contact your platform administrator.' : 'Your account link may have expired or you may have copied it incorrectly. Check your email or mobile device for the link. If you think here is an issue, you can contact your platform administrator.'}`,
				authGroup: safeAG,
				authGroupLogo: authGroup.config.ui.skin.logo || undefined,
				splashImage: authGroup.config.ui.skin.splashImage || undefined,
				bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
				bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH
			});
		}
	},
	issuerArray(provider, g) {
		const issuer = provider.issuer.split('/');
		const id = issuer[issuer.length-1];
		if((g._id || g.id) !== id) {
			throw new Error('OP issuer validation error');
		}
		issuer[issuer.length-1] = g.prettyName;
		return [provider.issuer, issuer.join('/')];
	}
};

export default core;