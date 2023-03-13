import express from 'express';
import m from '../middleware';

import api from '../api/plugins/webauthn/api';

const router = express.Router();

// bind user
router.post('/:group/webauthn/bind', [
	//schema
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isAuthenticatedOrIATState
], api.bindWebAuthN);

// finish user bind
router.post('/:group/webauthn/finish', [
	//schema
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isAuthenticatedOrIATState
], api.finishWebAuthN);

// prepare webAuthN auth req
router.post('/:group/webauthn/authenticate', [
	//schema
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
], api.reqWebAuthN);

export default router;