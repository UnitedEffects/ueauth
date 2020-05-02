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
//todo make health a little more robust
router.get('/health', (req, res) => {
    res.json({data: {server: 'running'}});
});

// Auth Groups
// todo client access - only those clients from ueauth group
router.post('/group', [m.schemaCheck], group.write);
router.get('/group', group.get);
router.get('/group/:id', group.getOne);
router.patch('/group/:id', [m.schemaCheck], group.patch);

// Auth Group Functional
router.get('/groupcheck/:prettyName', group.check);

// Accounts
// todo client access - if authGroup matches, let them in
router.post('/:authGroup/account', [m.validateAuthGroup, m.schemaCheck, m.captureAuthGroupInBody], account.writeAccount);
router.get('/:authGroup/account', [m.validateAuthGroup], account.getAccounts);
router.get('/:authGroup/account/:id', [m.validateAuthGroup], account.getAccount);
router.patch('/:authGroup/account/:id', [m.validateAuthGroup, m.schemaCheck], account.patchAccount);
//todo no client access, only user and authGroup owner for delete
router.delete('/:authGroup/account/:id', [m.validateAuthGroup], account.deleteAccount);

// Clients
//todo user based access only on all clients - admin
router.get('/:authGroup/client', [m.validateAuthGroup], client.get);
//todo allow client but must validate client request access token as bearer first - otherwise admin
router.get('/:authGroup/client/:id', [m.validateAuthGroup], client.getOne);
//todo limited patch for admin or client request access token as bearer
//router.patch();
//todo hard delete - admin or client request access token as bearer
router.delete('/:authGroup/client/:id', [m.validateAuthGroup], client.deleteOne);

// Operations
//todo allow admin or client request access token as bearer
router.post('/:authGroup/operations/client/:id', [m.validateAuthGroup], client.clientOperations);

module.exports = router;
