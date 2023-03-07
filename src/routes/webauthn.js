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

// prepare webAuthN auth req todo swagger
router.post('/:group/webauthn/authenticate', [
	//schema
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
], api.reqWebAuthN);

export default router;