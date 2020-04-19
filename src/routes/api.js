import express from 'express';
import log from '../api/logging/api';
import account from '../api/accounts/api';
import group from '../api/authGroup/api';
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
router.get('/health', (req, res) => {
    res.json({data: {server: 'running'}});
});

// Auth Groups
router.post('/group', [m.schemaCheck], group.write);
router.get('/group', group.get);
router.get('/group/:id', group.getOne);
router.patch('/group/:id', [m.schemaCheck], group.patch);

// Auth Group Functional
router.get('/groupcheck/:prettyName', group.check);

// Accounts
router.post('/account', [m.schemaCheck], account.writeAccount);
router.get('/account/:authGroup', [m.validateAuthGroup], account.getAccounts);
router.get('/account/:authGroup/:id', [m.validateAuthGroup], account.getAccount);
router.patch('/account/:authGroup/:id', [m.schemaCheck, m.validateAuthGroup], account.patchAccount);

// Clients
router.get('/client/:authGroup', [m.validateAuthGroup], client.get);
router.get('/client/:authGroup/:id', [m.validateAuthGroup], client.getOne);

module.exports = router;
