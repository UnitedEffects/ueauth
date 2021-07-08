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
			if(!req.body.id_token) throw Boom.preconditionRequired('id_token is required');
			if(!req.body.code) throw Boom.preconditionRequired('code is required');
			if(!req.body.redirect_uri) throw Boom.preconditionFailed('Redirect_uri is required');
			const idToken = req.body.id_token;
			const code = req.body.code;
			const redirect_uri = req.body.redirect_uri;
			if(!helper.isJWT(idToken)) throw Boom.preconditionRequired('id_token must be valid jwt');
			const preDecoded = jwt.decode(idToken, {complete: true});
			if(!preDecoded.payload.group) throw Boom.unauthorized();
			const subAG = await group.getOneByEither(preDecoded.payload.group);
			if(!subAG) throw Boom.unauthorized();
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
						const result = await access.getUIAccessTokens(subAG, decoded.iss, code, cl.payload, redirect_uri);
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