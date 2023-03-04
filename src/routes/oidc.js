import express from 'express';
import bodyParser from 'body-parser';
import api from '../api/oidc/api';
import m from '../middleware';
import interactions from '../api/oidc/interactions/api';
//import chApi from '../api/plugins/challenge/api';
//import account from '../api/accounts/api';

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
router.get('/:group/interaction/:uid/login', [
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
// mfa validation
router.post('/:group/interaction/:uid/confirm-mfa', [
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
router.get('/:group/interaction/callback/:spec/:provider/:name', [
	jsonParser,
	urlParser,
	m.setNoCache,
	m.validateAuthGroup,
], interactions.callbackLogin);

// this post is primarily used by apple oauth
router.post('/:group/interaction/callback/:spec/:provider/:name', [
	jsonParser,
	urlParser,
	m.setNoCache,
	m.validateAuthGroup
], interactions.postCallBackLogin);

// confirm / consent interaction
router.post('/:group/interaction/:uid/confirm', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], interactions.confirm);

// Magic Link
router.get('/:group/interaction/:uid/passwordless', [
	jsonParser,
	m.setNoCache,
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], interactions.noPassLogin);

/**
 * Account Service Endpoints

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
*/

//pass all other requests to the OP caller
router.use('/:group', m.validateHostDomain, api.oidcCaller);


export default router;
