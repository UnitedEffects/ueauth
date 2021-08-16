import Boom from '@hapi/boom';
import helper from '../../../helper';
import jwt from 'jsonwebtoken';
import group from '../../authGroup/group';
import njwk from 'node-jwk';
import access from './access';
import client from '../client/clients';

export default {
	async getUIAccessTokens(req, res, next) {
		try {
			if(!req.body.idToken) throw Boom.preconditionRequired('idToken is required');
			if(!req.body.code) throw Boom.preconditionRequired('code is required');
			if(!req.body.redirectUri) throw Boom.preconditionFailed('RedirectUri is required');
			if(!req.body.clientId) throw Boom.preconditionFailed('ClientId is required');
			const idToken = req.body.idToken;
			const code = req.body.code;
			const redirectUri = req.body.redirectUri;
			const clientId = req.body.clientId;
			if(!helper.isJWT(idToken)) throw Boom.preconditionRequired('idToken must be valid jwt');
			const preDecoded = jwt.decode(idToken, {complete: true});
			if(!preDecoded.payload.group) throw Boom.unauthorized();
			const subAG = await group.getOneByEither(preDecoded.payload.group);
			if(!subAG) throw Boom.unauthorized();
			if(subAG.associatedClient !== clientId) throw Boom.unauthorized();
			const cl = await client.getOneFull(subAG, subAG.associatedClient);
			if(!cl) throw Boom.unauthorized();
			if(!cl.payload) throw Boom.unauthorized();
			const pub = { keys: subAG.config.keys };
			const myKeySet = njwk.JWKSet.fromJSON(JSON.stringify(pub));
			const jwk = myKeySet.findKeyById(preDecoded.header.kid);
			const myPubKey = jwk.key.toPublicKeyPEM();

			return jwt.verify(idToken, myPubKey, async (err, decoded) => {
				if(err) {
					console.error(err);
					return next(Boom.unauthorized());
				}
				if(decoded) {
					try {
						// get access token
						const result = await access.getUIAccessTokens(
							subAG, decoded.iss, code, cl.payload, redirectUri);
						return res.json(result.data);
					} catch (error) {
						console.info(error);
						if(error.isAxiosError) {
							if(error.response && error.response.data && error.response.data.error_description) {
								return next(Boom.badData(error.response.data.error_description));
							}
						}
						return next(Boom.badData(error.message));
					}
				}
			});
		} catch (error) {
			next(error);
		}
	}
};