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
            api: p.name,
            version: p.version,
            baseURL: '/api',
            copyright: `Copyright (c) ${date.getFullYear()} United Effects LLC`
        }
    });
});

// Log and Health
//router.get('/logs', log.getLogs);
//router.get('/logs/:id', log.getLog);
//router.post('/logs', [m.schemaCheck], log.writeLog);

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
router.post('/:authGroup/account', [m.validateAuthGroup, m.schemaCheck, m.captureAuthGroupInBody], account.writeAccount);
router.get('/:authGroup/account', [m.validateAuthGroup], account.getAccounts);
router.get('/:authGroup/account/:id', [m.validateAuthGroup], account.getAccount);
router.patch('/:authGroup/account/:id', [m.validateAuthGroup, m.schemaCheck], account.patchAccount);

// Clients
//todo user based access only on all clients
router.get('/:authGroup/client', [m.validateAuthGroup], client.get);
//todo must validate client request access token as bearer
router.get('/:authGroup/client/:id', [m.validateAuthGroup], client.getOne);

module.exports = router;
