import express from 'express';
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

router.post('/:group/operations', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('operations')
], group.operations);

export default router;
