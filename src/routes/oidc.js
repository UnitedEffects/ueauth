import express from 'express';
import oidc from '../api/oidc/oidc';

const router = express.Router();

// OIDC Auth
oidc.proxy = true;
router.use('/:authGroup', oidc.callback);

module.exports = router;
