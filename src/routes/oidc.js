import express from 'express';
import bodyParser from 'body-parser';
import api from '../api/oidc/api';
import m from '../middleware';
import interactions from '../api/oidc/interactions/api';

const jsonParser = bodyParser.json();
const urlParser = bodyParser.urlencoded({extended:true});

const router = express.Router();

router.post('/:group/token/initial-access', [
	jsonParser,
	m.validateAuthGroup,
	m.captureAuthGroupInBody,
	m.isAuthenticated,
	m.permissions
], api.getInitialAccessToken);

/**
 * OP Defined Interactions
 */
// primary interaction controller
router.get('/:group/interaction/:uid', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], interactions.getInt);
// abort interaction
router.get('/:group/interaction/:uid/abort', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup
], interactions.abort);
// login interaction
router.post('/:group/interaction/:uid/login', [
	jsonParser,
	urlParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], interactions.login);
// federated login
router.post('/:group/interaction/:uid/federated', [
	jsonParser,
	urlParser,
	m.setNoCache,
	m.validateAuthGroup,
	interactions.oidcFederationClient
], interactions.federated);
router.get('/:group/interaction/callback/login', [
	jsonParser,
	urlParser,
	m.setNoCache,
	m.validateAuthGroup
], interactions.callbackLogin);
// confirm / consent interaction
router.post('/:group/interaction/:uid/confirm', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], interactions.confirm);

/**
 * Password-less routes, not defined directly by OP Library
 */
router.get('/:group/interaction/:uid/passwordless-request', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], interactions.passwordless);
router.post('/:group/interaction/:uid/passwordless', [
	jsonParser,
	urlParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], interactions.sendPasswordFree);
router.get('/:group/interaction/:uid/passwordless', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], interactions.noPassLogin);

/**
 * Password Reset and Account Verify
 */
router.post('/:group/setpass', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.isAuthenticatedOrIAT
], interactions.forgot);
router.get('/:group/forgotpassword', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], interactions.forgotPasswordScreen);
router.get('/:group/verifyaccount', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup
], interactions.verifyAccountScreen);

//pass all other requests to the OP caller
router.use('/:group', m.validateHostDomain, api.oidcCaller);


export default router;
