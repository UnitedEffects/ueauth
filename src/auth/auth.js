import passport from 'passport';
import jwt from 'jsonwebtoken';
import njwk from 'node-jwk';
import Boom from '@hapi/boom';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import iat from '../api/oidc/initialAccess/iat';
import account from '../api/accounts/account';
import oidc from '../api/oidc/oidc';
import cl from '../api/oidc/client/clients';
import group from '../api/authGroup/group';
import session from '../api/oidc/session/session';
import helper from '../helper';

const config = require('../config');

async function getUser(authGroup, decoded, token) {
	/**
     * We look up the user from the DB directly rather than going through an OIDC http request since this is an internal
     * lookup and this is the system of record. Additionally, since this is to authorize access to this service itself, we
     * don't worry about scopes - we can access that data at anytime anyway.
     */
	const userRecord = await oidc(authGroup).Account.findAccount({authGroup}, decoded.sub, token);
	if(!userRecord) return undefined;
	return await userRecord.claims();
}

async function getClient(authGroup, decoded) {
	/**
	 * When client credential token comes, we look up the client itself
	 */
	return cl.getOne(authGroup, decoded.sub || decoded.client_id);
}

// @notTested
async function introspect(token, authGroup) {
	/**
     * Looking up the token directly for decoding since this is the system of record.
	 * External systems would make an http request to the
     * introspect endpoint.
     * @type {AccessToken}
     */
	let accessToken = await oidc(authGroup).AccessToken.find(token);
	if(!accessToken) {
		// try client-credentials
		accessToken = await oidc(authGroup).ClientCredentials.find(token);
	}
	if(!accessToken) return null;
	return {
		active: (accessToken.iat < accessToken.exp),
		sub: accessToken.accountId,
		group: (accessToken.extra && accessToken.extra.group) ? accessToken.extra.group : undefined,
		client_id: accessToken.clientId,
		exp: accessToken.exp,
		iat: accessToken.iat,
		iss: (accessToken.extra && accessToken.extra.group) ? `${config.PROTOCOL}://${config.SWAGGER}/${accessToken.extra.group}` : undefined,
		jti: accessToken.jti,
		scope: accessToken.scope,
		aud: accessToken.aud,
		token_type: 'Bearer'
	};
}

async function runDecodedChecks(token, issuer, decoded, authGroup) {
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
		if(decoded.client_id !== authGroup.associatedClient) {
			throw Boom.unauthorized('Token client ID not specific to this auth group client');
		}
	}
	if(decoded.azp) {
		// client credential issuing client - azp
		if(decoded.azp !== authGroup.associatedClient) {
			throw Boom.unauthorized('Client Credential token not issued by group associated client');
		}
	}
	//check sub if present
	if(decoded.sub && decoded.client_id !== decoded.sub) {
		const user = await getUser(authGroup, decoded, token);
		if(!user) throw Boom.unauthorized('User not recognized');
		// Check auth group
		if (!user.group && user.group !== decoded.group) {
			throw Boom.unauthorized('User not associated with indicated auth group');
		}
		return { ...user, decoded, subject_group: authGroup };
	}
	// client_credential - note, permissions may still stop the request
	if((decoded.client_id === decoded.sub) || (!decoded.sub && decoded.client_id)) {
		const cl = await getClient(authGroup, decoded);
		if(!cl) throw Boom.unauthorized('Client not found');
		let client = JSON.parse(JSON.stringify(cl));
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
}

passport.serializeUser(function(user, done) {
	done(null, user);
});
passport.deserializeUser(function(user, done) {
	done(null, user);
});

passport.use('iat-group-create', new BearerStrategy({
	passReqToCallback: true
},
async (req, token, next) => {
	try {
		if (!req.authGroup) throw Boom.preconditionFailed('Auth Group not recognized');
		if (req.authGroup.active === true) return next(null, true);
		if (!req.body.email) throw Boom.preconditionRequired('username is required');
		if (!req.body.password) throw Boom.preconditionRequired('password is required');
		if (req.body.email !== req.authGroup.owner) throw Boom.preconditionFailed('Activating account email must match new auth group owner email');
		const reqBody = req.body;
		const authGroupId = req.authGroup._id;
		const access = await iat.getOne(token, authGroupId);
		if(!access) return next(null, false);
		return next(null, { initialAccessToken: true }, { ...reqBody, authGroup: authGroupId, token: access });
	} catch (error) {
		return next(error);
	}
}
));

passport.use('user-iat-password', new BearerStrategy({
	passReqToCallback: true
},
async (req, token, next) => {
	try {
		if (!req.authGroup) throw Boom.preconditionFailed('Auth Group not recognized');
		const access = await iat.getOne(token, req.authGroup.id);
		if(!access) return next(null, false);
		const payload = JSON.parse(JSON.stringify(access.payload));
		if(!payload) return next(null, false);
		if(payload.kind !== 'InitialAccessToken') return next(null, false);
		const user = await account.getAccount(req.authGroup.id, payload.sub);
		if(!user) return next(null, false);
		if(user.email !== payload.email) return next(null, false);
		if(user.authGroup !== payload.auth_group) return next(null, false);
		if(user.authGroup !== req.authGroup.id) return next(null, false);
		try {
			//attempt to clear iat and log the user out of other sessions but don't get hung up
			await iat.deleteOne(access._id, req.authGroup.id);
			// Clear out the existing sessions and force a login
			await session.removeSessionByAccountId(user.id);
		} catch (e) {
			console.error('check to make sure initial access tokens are deleting once used and that the user does not have active sessions');
			console.error(e);
		}
		const subject = JSON.parse(JSON.stringify(user));
		subject.sub = subject.id;
		return next(null, { ...subject, decoded: payload, subject_group: req.authGroup }, token);
	} catch (error) {
		return next(error);
	}
}
));

passport.use('oidc', new BearerStrategy({
	passReqToCallback: true
},
async (req, token, next) => {
	try {
		// subject (user) auth group
		// this is distinct from the authGroup which was specified in the request and now under req.authGroup
		let subAG = req.authGroup;
		let issuer;
		if(!subAG) {
			issuer = null;
		} else {
			issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${subAG.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${subAG.id}`];
		}
		if(helper.isJWT(token)){
			const preDecoded = jwt.decode(token, {complete: true});
			if(issuer !== null && preDecoded.payload.group !== subAG.id) {
				// there is a problem with the token authgroup,
				// we reset issuer here so we can check to see if this is a root account (super admin)
				// console.info('debug check (delete later) - issuer cleared');
				issuer = null;
			}
			if(issuer === null) {
				subAG = await group.getOneByEither(preDecoded.payload.group);
				if(!subAG) return next(null, false);
				if(subAG.prettyName !== 'root') return next(null, false); //hard coded check that only root can access across auth groups
				if(!req.authGroup) req.authGroup = subAG;
				issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${subAG.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${subAG.id}`];
			}
			const pub = { keys: subAG.config.keys };
			const myKeySet = njwk.JWKSet.fromJSON(JSON.stringify(pub));
			const jwk = myKeySet.findKeyById(preDecoded.header.kid);
			const myPubKey = jwk.key.toPublicKeyPEM();

			return jwt.verify(token, myPubKey, async (err, decoded) => {
				if(err) {
					console.error(err);
					return next(null, false);
				}
				if(decoded) {
					try {
						const result = await runDecodedChecks(token, issuer, decoded, subAG);
						if(decoded.scope) {
							if(req.permissions) req.permissions.scopes = decoded.scope;
							else {
								req.permissions = {
									scopes: decoded.scope
								}
							}
						}
						return next(null, result, { token });
					} catch (error) {
						console.error(error);
						return next(null, false);
					}
				}
			});
		}
		//opaque token
		if(issuer === null) {
			//assume this is a root request
			subAG = await group.getOneByEither('root');
			issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${subAG.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${subAG.id}`];
		}
		const inspect = await introspect(token, subAG);
		if(inspect) {
			if (inspect.active === false) return next(null, false);
			try {
				if(subAG.id !== inspect.group) {
					//check to see if this is a root account
					subAG = await group.getOneByEither(inspect.group);
					if(subAG.prettyName !== 'root') return next(null, false) //we already know this is invalid
					// now we know its a root account so we reset subAG
					issuer = [];
					issuer.push(`${config.PROTOCOL}://${config.SWAGGER}/${subAG.prettyName}`);
					issuer.push(`${config.PROTOCOL}://${config.SWAGGER}/${subAG.id}`)
				}
				const result = await runDecodedChecks(token, issuer, inspect, subAG);
				if(!req.authGroup) req.authGroup = subAG;
				return next(null, result, { token });
			} catch (error) {
				console.error(error);
				return next(null, false);
			}
		}
		return next(null, false);
	} catch (error) {
		console.error(error);
		return next(null, false);
	}
}
));

// @notTested
async function whitelist(req, res, next) {
	try {
		if(config.ENV !== 'dev'){
			if(config.UI_WHITE_LIST().includes(req.hostname) && req.secure) return next();
		} else {
			if(config.UI_WHITE_LIST().includes(req.hostname)) return next();
		}
		throw Boom.unauthorized();
	} catch (error) {
		next(error);
	}
}

export default {
	isIatAuthenticatedForGroupActivation: passport.authenticate('iat-group-create', { session: false }),
	isAuthenticatedOrIATUserUpdates: passport.authenticate(['oidc', 'user-iat-password'], { session: false }),
	//isLockedGroupIatAuth: passport.authenticate('iat-group-register', { session: false }),
	isAuthenticated: passport.authenticate('oidc', { session: false }),
	isWhitelisted: whitelist,
	getUser, // for testing
	getClient, // for testing
	runDecodedChecks // for testing
};