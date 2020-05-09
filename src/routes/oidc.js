import express from 'express';
import bodyParser from 'body-parser';
import api from '../api/oidc/api';
import m from "../middleware";

const jsonParser = bodyParser.json();
const router = express.Router();

//todo authorization to use this required
router.post('/:group/token/initial-access', [jsonParser, m.validateAuthGroup, m.captureAuthGroupInBody], api.getInitialAccessToken);
router.use('/:group', api.oidcCaller);


module.exports = router;
