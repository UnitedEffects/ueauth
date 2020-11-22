import Boom from '@hapi/boom';
import express from 'express';
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

//todo make health a little more robust
router.get('/health', (req, res) => {
    res.json({data: {server: 'running'}});
});

// todo - delete this later, temp access blocker
async function noGo(req, res, next) {
    return next(Boom.unauthorized());
}

// Initialize - ONLY FOR FIRST START - NOT INCLUDED IN SWAGGER
router.post('/init', group.initialize);

// Auth Groups
// todo access... owner and client?
router.post('/group', [m.schemaCheck], group.write);
//todo - only a super admin should be able to do this... that's a permission not yet created
router.get('/group', noGo, group.get);
router.get('/group/:id', group.getOne);
router.patch('/group/:id', [m.schemaCheck], group.patch);

// Auth Group Functional
router.get('/groupcheck/:prettyName', group.check);

// Accounts
// todo client access - if authGroup matches, let them in
router.post('/:group/account', [
    m.validateAuthGroupAllowInactive,
    m.schemaCheck,
    m.setGroupActivationEvent,
    m.isIatGroupActivationAuthorized,
    m.captureAuthGroupInBody], account.writeAccount);
router.get('/:group/account', [
    m.validateAuthGroup,
    m.isAuthenticated,
    m.permissions,
    m.access], account.getAccounts);
//todo update access to account for own account
router.get('/:group/account/:id', [
    m.validateAuthGroup,
    m.isAuthenticated,
    m.permissions,
    m.access], account.getAccount);
router.patch('/:group/account/:id', [
    m.validateAuthGroup,
    m.isAuthenticated,
    m.schemaCheck,
    m.permissions,
    m.access], account.patchAccount);
//todo no client access, only user and authGroup owner for delete
router.delete('/:group/account/:id', [
    m.validateAuthGroup,
    m.isAuthenticated,
    m.permissions,
    m.access], account.deleteAccount);

// Clients
//todo user based access only on all clients - admin
router.get('/:group/client', [m.validateAuthGroup, m.isAuthenticated, m.permissions, m.access], client.get);
//todo allow client but must validate client request access token as bearer first - otherwise admin
router.get('/:group/client/:id', [m.validateAuthGroup, m.isAuthenticated, m.permissions, m.access], client.getOne);
//todo limited patch for admin or client request access token as bearer
router.patch('/:group/client/:id', [m.validateAuthGroup, m.isAuthenticated, m.schemaCheck, m.permissions, m.access], client.patchOne);
//todo hard delete - admin or client request access token as bearer
router.delete('/:group/client/:id', [m.validateAuthGroup, m.isAuthenticated, m.permissions, m.access], client.deleteOne);

// Operations
//todo allow admin or client request access token as bearer (update access for this)
router.post('/:group/operations/client/:id', [m.validateAuthGroup, m.isAuthenticated, m.schemaCheck, m.permissions, m.access], client.clientOperations);
// todo admin only...
router.post('/:group/operations', [m.validateAuthGroup, m.isAuthenticated, m.schemaCheck, m.permissions, m.access], group.operations);

module.exports = router;
