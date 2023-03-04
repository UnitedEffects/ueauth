import express from 'express';
import m from '../middleware';
import plugins from '../api/plugins/api';

const router = express.Router();

router.post('/plugins/global/notifications', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('plugins')], plugins.toggleGlobalNotifications);
router.post('/plugins/global/web-auth-n', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('plugins')], plugins.toggleGlobalWebAuthN);
router.post('/plugins/global/mfa-challenge', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('plugins')], plugins.toggleGlobalMFASettings);
router.post('/plugins/global/event-stream', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('plugins')], plugins.toggleGlobalEventStreamSettings);
router.get('/plugins/global', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('plugins')], plugins.getLatestPluginOptions);
router.get('/plugins/global/audit', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('plugins')], plugins.auditPluginOptions);

// Notifications
router.post('/:group/notification', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access('notification'),
], plugins.writeNotification);
router.get('/:group/notifications', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access('notification'),
], plugins.getNotifications);
router.get('/:group/notification/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access('notification')
], plugins.getNotification);
router.delete('/:group/notification/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access('notification')
], plugins.deleteNotification);

// Notifications with Organization Context
router.post('/:group/organization/:org/notification', [
	m.schemaCheck,
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access('notification'),
], plugins.writeNotification);
router.get('/:group/organization/:org/notifications', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access('notification'),
], plugins.getNotifications);
router.get('/:group/organization/:org/notification/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access('notification')
], plugins.getNotification);
router.delete('/:group/organization/:org/notification/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access('notification')
], plugins.deleteNotification);

// Process Notifications
router.put('/:group/notification/:id/process', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access('notification')
], plugins.processNotification);
router.post('/:group/notification/process', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.getGlobalPluginSettings,
	m.validateNotificationRequest,
	m.permissions,
	m.access('notification')
], plugins.bulkNotificationProcess);

export default router;