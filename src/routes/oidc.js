import express from 'express';
import middle from  '../oidcMiddleware';
import oidc from '../api/oidc/oidc';
const bodyParser = require('koa-bodyparser');

const router = express.Router();

// OIDC Auth
oidc.proxy = true;
oidc.use(bodyParser());
oidc.use(middle.parseKoaOIDC);
oidc.use(middle.validateAuthGroup);

router.use('/:authGroup', oidc.callback);


module.exports = router;
