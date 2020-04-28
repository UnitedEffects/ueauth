import express from 'express';
import helper from '../helper';
import oidc from '../api/oidc/oidc';

const router = express.Router();

router.use('/:authGroup', (req, res, next) => {
    if (!req.params.authGroup) return next();
    if (helper.protectedNames(req.params.authGroup)) return next();
    const tenant = req.params.authGroup;
    return oidc(tenant).callback(req, res, next);
});


module.exports = router;
