import express from 'express';
import helper from '../helper';
import oidc from '../api/oidc/oidc';

const router = express.Router();

router.use('/:group', (req, res, next) => {
    if (!req.params.group) return next();
    if (helper.protectedNames(req.params.group)) return next();
    const tenant = req.params.group;
    return oidc(tenant).callback(req, res, next);
});


module.exports = router;
