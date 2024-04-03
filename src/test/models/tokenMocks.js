import { v4 as uuid } from 'uuid';
import { nanoid } from 'nanoid';
const cryptoRandomString = require('crypto-random-string');
const { uniqueNamesGenerator, adjectives, colors, animals } = require('unique-names-generator');

const config = require('../../config');

const toks = {
	opaque_access_token: cryptoRandomString({length: 86, type: 'url-safe'}),
	decoded_jwt(access = true, expired = false, ag = undefined) {
		const group = (ag) ? ag._id : nanoid();
		const pretty = (ag) ? ag.prettyName : uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals] });
		const client_id = uuid();
		let sub;
		if(!access) sub = client_id;
		else sub = uuid();
		const iat = Date.now();
		const exp = (expired) ? iat-10000 : iat+10000;
		return {
			group,
			jti: cryptoRandomString({length: 21, type: 'url-safe'}),
			sub,
			iat,
			exp,
			scope: 'core:read core:update core:write core:delete',
			client_id,
			iss: `http://${config.SWAGGER}/${group}`,
			aud: `http://${config.SWAGGER}/${pretty}`
		};
	},
	iatPreMeta: {
		'_id': 'DZlWHOHeFY-FcAuGYWc4WA3ISx0x8ox_dVbUtKz42jn',
		'__v': 0,
		'expiresAt': '2021-10-02T17:39:44.370Z',
		'payload': {
			'iat': 1630517984,
			'exp': 1633196384,
			'policies': [
				'auth_group'
			],
			'kind': 'InitialAccessToken',
			'jti': 'DZlWHOHeFY-FcAuGYWc4WA3ISx0x8ox_dVbUtKz42jn'
		}
	},
	iatPostMeta: {
		'_id': 'DZlWHOHeFY-FcAuGYWc4WA3ISx0x8ox_dVbUtKz42jn',
		'__v': 0,
		'expiresAt': '2021-10-02T17:39:44.370Z',
		'payload': {
			'iat': 1630517984,
			'exp': 1633196384,
			'policies': [
				'auth_group'
			],
			'kind': 'InitialAccessToken',
			'jti': 'DZlWHOHeFY-FcAuGYWc4WA3ISx0x8ox_dVbUtKz42jn',
			'auth_group': 'X2lgt285uWdzq5kKOdAOj'
		}
	}
};

export default toks;