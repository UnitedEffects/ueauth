import express from 'express';
import account from '../api/accounts/api';
import group from '../api/authGroup/api';
import client from '../api/oidc/client/api';
import m from '../middleware';

const router = express.Router();

// Initialize - ONLY FOR FIRST START - NOT INCLUDED IN SWAGGER
router.post('/init', group.initialize);

// System checks
router.get('/version', m.version);
router.get('/health', m.health);

// Auth Group Functional
router.get('/groupcheck/:prettyName', [m.isWhitelisted], group.check);
router.get('/group-info/:group', [
	m.conditionalAGValidate,
	m.isPublicOrAuth,
	m.pubOrPermissions
], group.getPublicGroupInfo);

// Auth Groups
router.post('/group', [
	m.schemaCheck,
	m.openGroupRegAuth,
	m.openGroupRegPermissions,
	m.openGroupRegAccess,
	m.getGlobalPluginSettings
], group.write);
router.get('/groups', [
	m.isAuthenticated,
	m.permissions,
	m.access('group')], group.get);
router.get('/group/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('group')], group.getOne);
router.patch('/group/:id', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isAuthenticated,
	m.permissions,
	m.access('group')], group.patch);

// Alias DNS - root only or client credential from root with role groupAliasDns
router.post('/group/:id/alias-dns', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.setRoleTarget('groupAliasDns'),
	m.enforceRole], group.addAliasDns);
router.delete('/group/:id/alias-dns/:target', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.setRoleTarget('groupAliasDns'),
	m.enforceRole], group.removeAliasDns);

// Accounts
router.post('/:group/account', [
	m.validateAuthGroupAllowInactive,
	m.schemaCheck,
	m.setGroupActivationEvent,
	m.isAuthorizedToCreateAccount,
	m.captureAuthGroupInBody,
	m.getGlobalPluginSettings,
	m.organizationContext,
	m.permissions,
	m.access('accounts')
], account.writeAccount);
router.post('/:group/accounts', [
	m.validateAuthGroup,
	m.schemaCheck,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.organizationContext,
	m.permissions,
	m.access('accounts')
], account.importAccounts);
router.get('/:group/accounts', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts'),
], account.getAccounts);
router.get('/:group/accounts/search', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts-organization'),
], account.searchAccounts);
router.get('/:group/organization/:org/accounts/search', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts-organization'),
], account.searchAccounts);
router.get('/:group/account/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts')
], account.getAccount);
router.patch('/:group/account/:id', [
	m.validateAuthGroup,
	m.isAuthenticatedOrIAT,
	m.schemaCheck,
	m.permissions,
	m.access('accounts')
], account.patchAccount);
router.delete('/:group/account/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts')
], account.deleteAccount);

// Account Locking and Recovery
router.put('/:group/account/codes', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.schemaCheck,
	m.permissions,
	m.access('accounts'),
], account.generateRecoveryCodes);
router.post('/:group/account/start-recovery', [
	m.validateAuthGroup,
	m.isWhitelisted,
	m.schemaCheck,
], account.initiateRecovery);
router.put('/:group/account/recover', [
	m.validateAuthGroup,
	m.isSimpleIAT,
	m.schemaCheck,
], account.recoverAccount);
router.put('/:group/account/panic', [
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isAccessOrSimpleIAT,
	m.schemaCheck
], account.lockAccount);

// Organization Accounts
router.put('/:group/organization/:org/account',[
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.permissions,
	m.access('accounts', 'organization')
], account.createOrAssociateAccount);
router.put('/:group/organization/:org/accounts',[
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts', 'organization')
], account.bulkAddAccountsToOrg);
router.delete('/:group/organization/:org/accounts',[
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts', 'organization')
], account.bulkRemoveAccountsFromOrg);
router.get('/:group/organization/:org/accounts', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts', 'organization')
], account.getAccountsByOrg);
router.get('/:group/organization/:org/account/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts', 'organization')
], account.getAccountByOrg);

// Clients
router.get('/:group/clients', [
	m.validateAuthGroup, m.isAuthenticated, m.permissions, m.access('clients')], client.get);
router.get('/:group/client/:id', [
	m.validateAuthGroup, m.isAuthenticated, m.permissions, m.access('clients')], client.getOne);
/*
router.patch('/:group/client/:id', [
	m.validateAuthGroup, 	m.isAuthenticated, m.schemaCheck, m.permissions, m.access('clients')], client.patchOne);*/
router.delete('/:group/client/:id', [
	m.validateAuthGroup, m.isAuthenticated, m.permissions, m.access('clients')], client.deleteOne);

// Operations
router.post('/:group/operations/client/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('operations', 'client')
], client.clientOperations);
router.post('/:group/operations/user/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('operations', 'user'),
	m.getGlobalPluginSettings,
], account.userOperations);
router.post('/:group/operations/organization/:org/user/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('operations', 'user', 'organization'),
	m.getGlobalPluginSettings,
], account.userOperationsByOrg);
router.post('/:group/operations', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('operations')
], group.operations);
router.post('/:group/operations/reset-user-password', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isWhitelisted
], account.resetPassword);
router.post('/:group/operations/resend-verify-email', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isWhitelisted
], account.resendVerifyEmail);

export default router;
