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
router.get('/:group/mfa/:key/account/:account/interaction/:uid/status', [
	m.validateAuthGroup
], challengeApi.status);

// Safe Recovery when MFA is Enabled
router.post('/:group/mfa/safe-recovery', [
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isSimpleIAT
], challengeApi.safeRecoveryNotification);

router.post('/:group/mfa/instructions', [
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isBasic
], challengeApi.getMFAInstruction);


/** things to expose/document
 * status - for polling
 * /api/:group/mfa/:key/account/:account/interaction/:uid/status
 * callback
 * /api/:group/mfa/callback
 * instructions: getMFAInstruction
 * /api/:group/mfa/instructions
 * safe-recovery: safeRecoveryNotification
 * /api/:group/mfa/safe-recovery
 * ----------------------------
 * challenge (new)
 * revoke (new)
 */

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