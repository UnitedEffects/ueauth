import express from 'express';
import middle from  '../oidcMiddleware';
import oidc from '../api/oidc/oidc';
const bodyParser = require('koa-bodyparser');

const router = express.Router();

router.use('/:authGroup', (req, res, next) => {
    if (!req.params.authGroup) next();
    const prefix = req.params.authGroup;
    return oidc(prefix).callback(req, res, next);
});


module.exports = router;
