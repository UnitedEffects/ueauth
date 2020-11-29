import passport from 'passport';
import jwt from 'jsonwebtoken';
import njwk from 'node-jwk';
import Boom from '@hapi/boom';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import iat from '../api/oidc/initialAccess/iat';
import oidc from '../api/oidc/oidc';
import group from "../api/authGroup/group";

const config = require('../config');

const jwtCheck = /^([A-Za-z0-9\-_~+\/]+[=]{0,2})\.([A-Za-z0-9\-_~+\/]+[=]{0,2})(?:\.([A-Za-z0-9\-_~+\/]+[=]{0,2}))?$/;
function isJWT(str) {
	return jwtCheck.test(str);
}

async function getUser(authGroup, decoded, token) {
	/**
     * We look up the user from the DB directly rather than going through an OIDC http request since this is an internal
     * lookup and this is the system of record. Additionally, since this is to authorize access to this service itself, we
     * don't worry about scopes - we can access that data at anytime anyway.
     */
	const userRecord = await oidc(authGroup).Account.findAccount({authGroup}, decoded.sub, token);
	return await userRecord.claims();
}

async function introspect(token, issuer, authGroup) {
	/**
     * Looking up the token directly for decoding since this is the system of record. External systems would make an http request to the
     * introspect endpoint.
     * @type {AccessToken}
     */
	const accessToken = await oidc(authGroup).AccessToken.find(token);
	return {
		active: (accessToken.iat < accessToken.exp),
		sub: accessToken.accountId,
		group: (accessToken.extra) ? accessToken.extra.group : undefined,
		client_id: accessToken.clientId,
		exp: accessToken.exp,
		iat: accessToken.iat,
		iss: issuer,
		jti: accessToken.jti,
		scope: accessToken.scope,
		token_type: (accessToken.format && accessToken.format === 'opaque') ? 'Bearer' : undefined
	};
}

async function runDecodedChecks(token, issuer, decoded, authGroup) {
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
		if(decoded.aud !== authGroup.associatedClient) {
			// check audience = client
			throw Boom.unauthorized('Token audience not specific to this auth group client');
		}
	}
	if(typeof decoded.aud === 'object') {
		if(!decoded.aud.includes(authGroup.associatedClient)) {
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
	if(decoded.sub && decoded.scope) {
		const user = await getUser(authGroup, decoded, token);
		// console.info(oidc(authGroup.id).issuer);
		if(!user) throw Boom.unauthorized('User not recognized');
		// Check auth group
		if (!user.group && user.group !== decoded.group) {
			throw Boom.unauthorized('User not associated with indicated auth group');
		}
		return { ...user, decoded, subject_group: authGroup };
	}
	if(decoded.sub && !decoded.scope) {
		//id_token
		throw Boom.unauthorized('API Access requires the access-token not the id-token');
	}
	// client_credential - note, permissions may still stop the request
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
		return next(null, true, { ...reqBody, authGroup: authGroupId, token: access });
	} catch (error) {
		return next(error);
	}
}
));

passport.use('iat-group-register', new BearerStrategy({
	passReqToCallback: true
},
async (req, token, next) => {
	try {
		if (!req.authGroup) throw Boom.preconditionFailed('Auth Group not recognized');
		if (req.authGroup.locked === false) return next(null, true);
		if (!req.body.email) throw Boom.preconditionRequired('username is required');
		if (!req.body.password) throw Boom.preconditionRequired('password is required');
		const reqBody = req.body;
		const authGroupId = req.authGroup._id;
		const access = await iat.getOne(token, authGroupId);
		if(!access) return next(null, false);
		const payload = JSON.parse(JSON.stringify(access.payload));
		if(payload.user_email === undefined) return next(null, false);
		if(payload.user_email !== req.body.email) return next(null, false);
		await iat.deleteOne(access._id, req.authGroup.id);
		return next(null, true, { ...reqBody, authGroup: authGroupId, token: access });
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
		if(isJWT(token)){
			const preDecoded = jwt.decode(token, {complete: true});
			if(issuer !== null && preDecoded.payload.group !== subAG.id) {
				// there is a problem with the token authgroup,
				// we reset issuer here so we can check to see if this is a root account (super admin)
				console.info('debug check (delete later) - issuer cleared');
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
						return next(null, result, { token });
					} catch (error) {
						console.error(error);
						return next(null, false);
					}
				}
			});
		}
		//opaque token
		if(issuer === null) return next(null, false); // jwt only if authGroup is not defined
		const inspect = await introspect(token, issuer[0], subAG);
		if(inspect) {
			if (inspect.active === false) return next(null, false);
			try {
				const result = await runDecodedChecks(token, issuer, inspect, subAG);
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

export default {
	isIatAuthenticated: passport.authenticate('iat-group-create', { session: false }),
	isLockedGroupIatAuth: passport.authenticate('iat-group-register', { session: false }),
	isAuthenticated: passport.authenticate('oidc', { session: false }),
};