import express from 'express';
import account from '../api/accounts/api';
import group from '../api/authGroup/api';
import client from '../api/oidc/client/api';
import m from '../middleware';

/**
 * Role short hand for access middleware
 * o - owner
 * m - member
 * c - client
 */

const router = express.Router();

// Initialize - ONLY FOR FIRST START - NOT INCLUDED IN SWAGGER
router.post('/init', group.initialize);

// System checks
router.get('/version', m.version);
router.get('/health', m.health);

// Auth Groups
// todo access... owner and client?
router.post('/group', [m.schemaCheck], group.write);

router.get('/groups', [
	m.isAuthenticated,
	m.permissions,
	m.access,
], group.get);
router.get('/group/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access,
], group.getOne);
router.patch('/group/:id', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access,
], group.patch);

// Auth Group Functional
router.get('/groupcheck/:prettyName', group.check);

// Accounts
router.post('/:group/account', [
	m.validateAuthGroupAllowInactive,
	m.schemaCheck,
	m.setGroupActivationEvent,
	m.isIatGroupActivationAuthorized,
	m.captureAuthGroupInBody
], account.writeAccount);
router.get('/:group/accounts', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access,
], account.getAccounts);
router.get('/:group/account/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access
], account.getAccount);
router.patch('/:group/account/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access
], account.patchAccount);
router.delete('/:group/account/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access
], account.deleteAccount);

// Clients
// todo - allow client_credential when from the client in question - this can be another role 'c'
router.get('/:group/clients', [m.validateAuthGroup, m.isAuthenticated, m.permissions, m.access], client.get);
router.get('/:group/client/:id', [m.validateAuthGroup, m.isAuthenticated, m.permissions, m.access], client.getOne);
router.patch('/:group/client/:id', [m.validateAuthGroup, 	m.isAuthenticated, m.schemaCheck, m.permissions, m.access], client.patchOne);
router.delete('/:group/client/:id', [m.validateAuthGroup, m.isAuthenticated, m.permissions, m.access], client.deleteOne);

// Operations
//todo - client as well 'c'
router.post('/:group/operations/client/:id', [m.validateAuthGroup, m.isAuthenticated, m.schemaCheck, m.permissions, m.access], client.clientOperations);
router.post('/:group/operations', [m.validateAuthGroup, m.isAuthenticated, m.schemaCheck, m.permissions, m.access], group.operations);

module.exports = router;
