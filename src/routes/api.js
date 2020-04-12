import express from 'express';
import log from '../api/logging/api';
import account from '../api/accounts/api';
import client from '../api/oidc/client/api';
import m from '../middleware';

const router = express.Router();
const p = require('../../package.json');
const date = new Date();

router.get('/version', (req, res) => {
    res.json( {
        data: {
            api: 'Boilerplate',
            version: p.version,
            baseURL: '/api',
            copyright: `Copyright (c) ${date.getFullYear()} theBoEffect LLC`
        }
    });
});

// Log and Health
router.get('/logs', log.getLogs);
router.get('/logs/:id', log.getLog);
router.post('/logs', [m.schemaCheck], log.writeLog);
router.patch('/logs/:id', [m.schemaCheck], log.patchLog); //For Example Only

router.get('/health', (req, res) => {
    res.json({data: {server: 'running'}});
});

// Accounts
router.post('/account', [m.schemaCheck], account.writeAccount);
router.get('/account/:authGroup', [m.validateAuthGroup], account.getAccounts);
router.get('/account/:authGroup/:id', [m.validateAuthGroup], account.getAccount);
router.patch('/account/:authGroup/:id', [m.schemaCheck, m.validateAuthGroup], account.patchAccount);

// Clients
router.get('/client/:authGroup', [m.validateAuthGroup], client.get);
router.get('/client/:authGroup/:id', [m.validateAuthGroup], client.getOne);

module.exports = router;
