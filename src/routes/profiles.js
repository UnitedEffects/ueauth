import express from 'express';
import profiles from '../api/profiles/api';
import m from '../middleware';

const router = express.Router();

// Organization User Profiles
router.post('/:group/organization/:org/profiles', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.getGlobalPluginSettings, //notify the user regarding information created
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('orgUserProfile')
], profiles.writeOrgProfile);
router.get('/:group/organization/:org/profiles', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('orgUserProfile')
], profiles.getOrgProfiles);
router.delete('/:group/organization/:org/profile/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.getGlobalPluginSettings, //notify user that profile was deleted
	m.isAuthenticated,
	m.permissions,
	m.access('orgUserProfile')
], profiles.deleteOrgProfile);
router.patch('/:group/organization/:org/profile/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.getGlobalPluginSettings, //notify user that data was updated
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('orgUserProfile')
], profiles.patchOrgProfile);
router.get('/:group/organization/:org/profile/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('orgUserProfile')
], profiles.getOrgProfile);

// User Only Controls
router.get('/:group/organizations/profiles/account/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('accounts')
], profiles.getAllMyOrgProfiles);

router.post('/:group/organizations/:org/profiles/account/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('accounts')
], profiles.myProfileRequest);

export default router;