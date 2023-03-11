import express from 'express';
import bodyParser from 'body-parser';
import api from '../api/oidc/api';
import iat from '../api/oidc/initialAccess/api';
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

// not on the production api doc
router.post('/:group/token/simple-iat', [
	jsonParser,
	m.validateAuthGroup,
	m.isBasicBearerOrDevice,
], iat.simpleIAT);

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

//pass all other requests to the OP caller
router.use('/:group', m.validateHostDomain, api.oidcCaller);


export default router;
