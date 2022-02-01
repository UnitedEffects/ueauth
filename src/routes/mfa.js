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
// todo whitelist host
router.get('/:group/mfa/:key/account/:account/interaction/:uid/status', [
	m.validateAuthGroup
], challengeApi.status);

// Safe Recovery when MFA is Enabled
router.post('/:group/mfa/safe-recovery', [
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isSimpleIAT
], challengeApi.safeRecoveryNotification);

// Bind user and get instructions
// todo allow both basic and bearer
router.post('/:group/mfa/instructions', [
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isBasic
], challengeApi.getMFAInstruction);

// In case we design something else for the callback system later
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