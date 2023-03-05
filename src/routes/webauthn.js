import express from 'express';
import m from '../middleware';

import api from '../api/plugins/webauthn/api';

const router = express.Router();

// bind user todo swagger
router.post('/:group/webauthn/bind', [
	//schema
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isAuthenticatedOrIATState
], api.bindWebAuthN);

// finish user bind todo swagger
router.post('/:group/webauthn/finish', [
	//schema
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isAuthenticatedOrIATState
], api.finishWebAuthN);

export default router;