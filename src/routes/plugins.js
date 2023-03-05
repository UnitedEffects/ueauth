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
router.post('/plugins/global/webauthn', [
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

export default router;