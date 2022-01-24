import express from 'express';
import m from '../middleware';
import Boom from '@hapi/boom';

import challengeApi from '../api/plugins/challenge/api';

const router = express.Router();

// Generic Callback
router.post('/:group/:function/callback', [
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], callback);

// Polling for MFA Session
router.get('/:group/interaction/:uid/provider/:key/account/:account/status', [
	m.validateAuthGroup
], challengeApi.status);

async function callback(req, res, next) {
	const func = req.params.function;
	switch(func.toLowerCase()) {
	case 'mfa':
		return challengeApi.callback(req, res, next);
	default:
		throw Boom.badRequest('unsupported callback function');
	}
}

export default router;