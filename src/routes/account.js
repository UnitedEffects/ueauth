import express from 'express';
import account from '../api/accounts/api';
import m from '../middleware';

const router = express.Router();

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

// Operations
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

//Utility Functions
router.get('/:group/account/login/options', [
	m.validateAuthGroup,
	m.getGlobalPluginSettings
], account.getAccountLogins);

export default router;
