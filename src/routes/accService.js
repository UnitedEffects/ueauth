import express from 'express';
import bodyParser from 'body-parser';
import m from '../middleware';
import chApi from '../api/plugins/challenge/api';
import wANApi from '../api/plugins/webauthn/api';
import account from '../api/accounts/api';

const jsonParser = bodyParser.json();

const router = express.Router();

/**
 * Account Service Endpoints
 */
// Form POST for setting new password
router.post('/:group/setpass', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.isAuthenticatedOrIAT
], account.forgot);

router.get('/:group/forgotpassword', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], account.forgotPasswordScreen);

router.get('/:group/verifyaccount', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.iatQueryCodeAuth,
], account.verifyAccountScreen);

router.get('/:group/recoveraccount', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], account.recoverFromPanic);

router.get('/:group/interaction/:uid/lockaccount', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
], account.panicScreen);

router.get('/:group/recover-mfa', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], chApi.recover);

router.get('/:group/set-passkey', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], wANApi.setWebAuthN);

router.get('/:group/passkey', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isQueryStateAndIAT
], wANApi.confirmWebAuthN);

export default router;
