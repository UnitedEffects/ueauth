import express from 'express';
import api from '../api/oidc/api';
import m from "../middleware";

const router = express.Router();

//todo authorization to use this required
router.post('/:group/token/initial-access', [m.validateAuthGroup, m.captureAuthGroupInBody], api.getInitialAccessToken);
router.use('/:group', api.oidcCaller);


module.exports = router;
