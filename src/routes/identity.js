import express from 'express';
import account from '../api/accounts/api';
import group from '../api/authGroup/api';
import invite from '../api/invites/api';
import client from '../api/oidc/client/api';
import plugins from '../api/plugins/api';
import access from '../api/oidc/access/api';
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

// Auth Group Functional
router.get('/groupcheck/:prettyName', [m.isWhitelisted], group.check);
router.get('/:group/group', [m.isWhitelisted], group.getPublicGroupInfo);
//deprecated because we can use pkce instead
//router.post('/token', [m.schemaCheck, m.isWhitelisted], access.getUIAccessTokens);

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
	m.access], group.get);
router.get('/group/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access], group.getOne);
router.patch('/group/:id', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access], group.patch);

// Plugins
router.post('/plugins/global/notifications', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access], plugins.toggleGlobalNotifications);
router.get('/plugins/global', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access], plugins.getLatestPluginOptions);
router.get('/plugins/global/audit', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access], plugins.auditPluginOptions);

// Notifications
router.post('/:group/notification', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access,
], plugins.writeNotification);
router.get('/:group/notifications', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access,
], plugins.getNotifications);
router.get('/:group/notification/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access
], plugins.getNotification);
router.delete('/:group/notification/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access
], plugins.deleteNotification);

router.put('/:group/notification/:id/process', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access
], plugins.processNotification);

router.post('/:group/notification/process', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access
], plugins.bulkNotificationProcess);

// Accounts
router.post('/:group/account', [
	m.validateAuthGroupAllowInactive,
	m.schemaCheck,
	m.setGroupActivationEvent,
	m.isAuthorizedToCreateAccount,
	m.captureAuthGroupInBody,
	m.getGlobalPluginSettings,
	m.permissions,
	m.access
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
	m.isAuthenticatedOrIAT,
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
router.get('/:group/clients', [m.validateAuthGroup, m.isAuthenticated, m.permissions, m.access], client.get);
router.get('/:group/client/:id', [m.validateAuthGroup, m.isAuthenticated, m.permissions, m.access], client.getOne);
router.patch('/:group/client/:id', [m.validateAuthGroup, 	m.isAuthenticated, m.schemaCheck, m.permissions, m.access], client.patchOne);
router.delete('/:group/client/:id', [m.validateAuthGroup, m.isAuthenticated, m.permissions, m.access], client.deleteOne);

// Operations
router.post('/:group/operations/client/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access
], client.clientOperations);
router.post('/:group/operations/user/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access,
	m.getGlobalPluginSettings,
], account.userOperations);
router.post('/:group/operations', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access
], group.operations);
router.post('/:group/operations/reset-user-password', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isWhitelisted
], account.resetPassword);
// Accept Invites
router.post('/:group/operations/invite/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access,
	m.getGlobalPluginSettings
], invite.inviteOperations);

// Invite Dashboard APIs
router.post('/:group/invite',[
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access,
	m.getGlobalPluginSettings
], invite.createInvite);
router.get('/:group/invites', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access
], invite.getInvites);
router.get('/:group/invite/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access
], invite.getInvite);
router.delete('/:group/invite/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access
], invite.deleteInvite);

module.exports = router;
