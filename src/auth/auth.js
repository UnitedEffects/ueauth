import passport from 'passport';
import jwt from 'jsonwebtoken';
import njwk from 'node-jwk';
import Boom from '@hapi/boom';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import { BasicStrategy } from 'passport-http';
import iat from '../api/oidc/initialAccess/iat';
import account from '../api/accounts/account';
import oidc from '../api/oidc/oidc';
import group from '../api/authGroup/group';
import session from '../api/oidc/session/session';
import helper from '../helper';
import core from './core';

passport.serializeUser(function(user, done) {
	done(null, user);
});
passport.deserializeUser(function(user, done) {
	done(null, user);
});

passport.use('basic', new BasicStrategy({
	passReqToCallback: true
},async (req, email, password, done) => {
	try {
		if (!req.authGroup) throw Boom.preconditionFailed('Auth Group not recognized');
		const authGroup = req.authGroup;
		if(authGroup.active !== true) return done(null, false);
		const user = await account.getAccountByEmailOrUsername(authGroup.id, email);
		if(authGroup && authGroup.config && authGroup.config.requireVerified === true) {
			if (user.verified === false) {
				return done(null, false);
			}
		}

		if(await user.verifyPassword(password)) {
			return done(null, user);
		}

		done(null, false);
	} catch (error) {
		done(null, false);
	}
}));

passport.use('simple-iat', new BearerStrategy({
	passReqToCallback: true
},
async (req, token, next) => {
	try {
		if (!req.authGroup) throw Boom.preconditionFailed('Auth Group not recognized');
		if (req.authGroup.active !== true) return next(null, false);
		const authGroupId = req.authGroup._id;
		const access = await iat.getOne(token, authGroupId);
		if(!access) {
			return next(null, false);
		}
		return next(null, JSON.parse(JSON.stringify(access.payload)));
	} catch (error) {
		return next(error);
	}
}));

passport.use('iat-user-state', new BearerStrategy({
	passReqToCallback: true
},
async (req, token, next) => {
	try {
		if (!req.authGroup) throw Boom.preconditionFailed('Auth Group not recognized');
		if (req.authGroup.active !== true) return next(null, false);
		if (!req.body.state) return next(null, false);
		const authGroupId = req.authGroup._id;
		const state = req.body.state;
		const access = await iat.getOne(token, authGroupId);
		if(!access) return next(null, false);
		if(access?.payload?.state !== state) return next(null, false);
		if(!access?.payload?.sub) return next(null, false);
		const user = await account.getAccount(authGroupId, access.payload.sub);
		if(!user) return next(null, false);
		return next(null, user, access.payload);
	} catch (error) {
		return next(error);
	}
}));

passport.use('iat-group-create', new BearerStrategy({
	passReqToCallback: true
},
async (req, token, next) => {
	try {
		if (!req.authGroup) throw Boom.preconditionFailed('Auth Group not recognized');
		if (req.authGroup.active === true) return next(null, true);
		if (!req.body.email) throw Boom.preconditionRequired('username is required');
		if (!req.body.generatePassword && !req.body.password) throw Boom.preconditionRequired('password is required or you must request password generation');
		if (req.body.email !== req.authGroup.owner) throw Boom.preconditionFailed('Activating account email must match new auth group owner email');
		const reqBody = req.body;
		const authGroupId = req.authGroup._id;
		const access = await iat.getOne(token, authGroupId);
		if(!access) return next(null, false);
		return next(null, { initialAccessToken: true }, { ...reqBody, authGroup: authGroupId, token: access });
	} catch (error) {
		return next(error);
	}
}));

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
			issuer = core.issuerArray(oidc(subAG, req.customDomain), JSON.parse(JSON.stringify(subAG)));
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
				if(req.customDomain) {
					if(subAG.aliasDnsOIDC && subAG.aliasDnsOIDC !== req.customDomain) return next(null, false);
				}
				issuer = core.issuerArray(oidc(subAG, req.customDomain), JSON.parse(JSON.stringify(subAG)));
			}
			const pub = { keys: subAG.config.keys };
			const myKeySet = njwk.JWKSet.fromJSON(JSON.stringify(pub));
			const jwk = myKeySet.findKeyById(preDecoded.header.kid);
			const myPubKey = jwk.key.toPublicKeyPEM();

			return jwt.verify(token, myPubKey, async (err, decoded) => {
				if(err) {
					//console.error(err);
					return next(null, false);
				}
				if(decoded) {
					try {
						const result = await core.runDecodedChecks(token, issuer, decoded, subAG, req.customDomain);
						return next(null, result, { token });
					} catch (error) {
						console.error('Problem Decoding Token', error);
						return next(null, false);
					}
				}
			});
		}
		//opaque token
		if(issuer === null) {
			//assume this is a root request
			subAG = await group.getOneByEither('root');
			if(req.customDomain) {
				if(subAG.aliasDnsOIDC && subAG.aliasDnsOIDC !== req.customDomain) return next(null, false);
			}
			issuer = core.issuerArray(oidc(subAG, req.customDomain), JSON.parse(JSON.stringify(subAG)));
		}
		const inspect = await core.introspect(token, subAG, req.customDomain);
		if(inspect) {
			if (inspect.active === false) return next(null, false);
			try {
				if(subAG.id !== inspect.group) {
					//check to see if this is a root account
					subAG = await group.getOneByEither(inspect.group);
					if(subAG.prettyName !== 'root') return next(null, false); //we already know this is invalid
					// now we know its a root account so we reset subAG
					if(req.customDomain) {
						if(subAG.aliasDnsOIDC && subAG.aliasDnsOIDC !== req.customDomain) return next(null, false);
					}
					issuer = core.issuerArray(oidc(subAG, req.customDomain), JSON.parse(JSON.stringify(subAG)));
				}
				const result = await core.runDecodedChecks(token, issuer, inspect, subAG,false,req.customDomain);
				if(!req.authGroup) req.authGroup = subAG;
				return next(null, result, { token });
			} catch (error) {
				//console.error(error);
				return next(null, false);
			}
		}
		return next(null, false);
	} catch (error) {
		return next(null, false);
	}
}
));

passport.use('oidc-token-validation', new BearerStrategy({
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
			issuer = core.issuerArray(oidc(subAG, req.customDomain), JSON.parse(JSON.stringify(subAG)));
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
				if(req.customDomain) {
					if(subAG.aliasDnsOIDC && subAG.aliasDnsOIDC !== req.customDomain) return next(null, false);
				}
				issuer = core.issuerArray(oidc(subAG, req.customDomain), JSON.parse(JSON.stringify(subAG)));
			}
			const pub = { keys: subAG.config.keys };
			const myKeySet = njwk.JWKSet.fromJSON(JSON.stringify(pub));
			const jwk = myKeySet.findKeyById(preDecoded.header.kid);
			const myPubKey = jwk.key.toPublicKeyPEM();

			return jwt.verify(token, myPubKey, async (err, decoded) => {
				if(err) {
					//console.error(err);
					return next(null, false);
				}
				if(decoded) {
					try {
						const result = await core.runDecodedChecks(token, issuer, decoded, subAG, true, req.customDomain);
						return next(null, result, { token });
					} catch (error) {
						console.error('Problem Decoding Token', error);
						return next(null, false);
					}
				}
			});
		}
		//opaque token
		if(issuer === null) {
			//assume this is a root request
			subAG = await group.getOneByEither('root');
			if(req.customDomain) {
				if(subAG.aliasDnsOIDC && subAG.aliasDnsOIDC !== req.customDomain) return next(null, false);
			}
			issuer = core.issuerArray(oidc(subAG, req.customDomain), JSON.parse(JSON.stringify(subAG)));
		}
		const inspect = await core.introspect(token, subAG, req.customDomain);
		if(inspect) {
			if (inspect.active === false) return next(null, false);
			try {
				if(subAG.id !== inspect.group) {
					//check to see if this is a root account
					subAG = await group.getOneByEither(inspect.group);
					if(subAG.prettyName !== 'root') return next(null, false); //we already know this is invalid
					// now we know its a root account so we reset subAG
					if(req.customDomain) {
						if(subAG.aliasDnsOIDC && subAG.aliasDnsOIDC !== req.customDomain) return next(null, false);
					}
					issuer = core.issuerArray(oidc(subAG, req.customDomain), JSON.parse(JSON.stringify(subAG)));
				}
				const result = await core.runDecodedChecks(token, issuer, inspect, subAG, true, req.customDomain);
				if(!req.authGroup) req.authGroup = subAG;
				return next(null, result, { token });
			} catch (error) {
				//console.error(error);
				return next(null, false);
			}
		}
		//console.error('Token expired');
		return next(null, false);
	} catch (error) {
		console.error('Unexpected OIDC Validation Error', error);
		return next(null, false);
	}
}
));

export default {
	isIatAuthenticatedForGroupActivation: passport.authenticate('iat-group-create', {
		session: false
	}),
	isAuthenticatedOrIATUserUpdates: passport.authenticate(['oidc', 'user-iat-password'], {
		session: false 
	}),
	isAccessOrSimpleIAT: passport.authenticate(['oidc', 'simple-iat'], {
		session: false
	}),
	isAuthenticatedOrIATState: passport.authenticate(['iat-user-state', 'oidc'], {
		session: false
	}),
	isBasicOrIATStateOrOIDC: passport.authenticate(['iat-user-state', 'basic', 'oidc'], {
		session: false
	}),
	isAuthenticated: passport.authenticate('oidc', { session: false }),
	isBasicOrBearer: passport.authenticate(['basic', 'oidc'], { session: false }),
	isOIDCValid: passport.authenticate('oidc-token-validation', { session: false }),
	isBasic: passport.authenticate('basic', { session: false }),
	isSimpleIAT: passport.authenticate('simple-iat', { session: false }),
	iatQueryCodeAuth: core.iatQueryCodeAuth,
	isWhitelisted: core.whitelist,
	async publicOrAuth (req, res, next) {
		const grabToken = req.headers?.authorization?.split(' ');
		if(grabToken?.length && grabToken[0].toLowerCase() === 'bearer') {
			// this is a token, we should do auth...
			return passport.authenticate('oidc', { session: false })(req, res, next);
		} else {
			req.user = null;
			return core.whitelist(req, res, next);
		}
	},
	async isQueryStateAndIAT(token, authGroupId, state) {
		const iToken = await iat.getOne(token, authGroupId);
		if(!iToken) throw Boom.unauthorized('This session may have expired');
		if(iToken?.payload?.state !== state) throw Boom.forbidden('State does not match');
		if(!iToken?.payload?.sub) throw Boom.forbidden('No user associated');
		const user = await account.getAccount(authGroupId, iToken.payload.sub);
		if(!user) throw Boom.forbidden('Unknown user');
		return { user, token: iToken.payload };
	}
};