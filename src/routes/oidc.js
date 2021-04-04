import express from 'express';
import bodyParser from 'body-parser';
import api from '../api/oidc/api';
import m from '../middleware';
import interactions from '../api/oidc/interactions/interactions_api';

const jsonParser = bodyParser.json();
const urlParser = bodyParser.urlencoded({extended:true});

const router = express.Router();

//todo authorization to use this required
router.post('/:group/token/initial-access', [jsonParser, m.validateAuthGroup, m.captureAuthGroupInBody, m.isAuthenticated, m.permissions], api.getInitialAccessToken);

// OIDC Interactions
//todo - might need to render error pages here instead of just throwing the error...
router.get('/:group/interaction/:uid', [jsonParser, m.setNoCache, m.validateAuthGroup], interactions.getInt);
router.post('/:group/interaction/:uid/login', [jsonParser, urlParser, m.setNoCache, m.validateAuthGroup], interactions.login);
router.post('/:group/interaction/:uid/confirm', [jsonParser, m.setNoCache, m.validateAuthGroup], interactions.confirm);
router.get('/:group/interaction/:uid/abort', [jsonParser, m.setNoCache, m.validateAuthGroup], interactions.abort);

// Custom Interactions
router.post('/:group/setpass', [jsonParser, m.setNoCache, m.validateAuthGroup, m.isAuthenticatedOrIAT], interactions.forgot);
router.get('/:group/forgotpassword', [jsonParser, m.setNoCache, m.validateAuthGroup], interactions.forgotPasswordScreen);

//rest of OIDC
router.use('/:group', api.oidcCaller);


module.exports = router;
