import express from 'express';
import profiles from '../api/profiles/api';
import m from '../middleware';

const router = express.Router();
// Secured Profile Access
router.get('/:group/profile/snapshot/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions
], profiles.querySnapShot);
router.delete('/:group/profile/snapshot/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions
], profiles.killSnapShot);
router.get('/:group/profile/accesses/:gor', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions
], profiles.getAllViews);
router.get('/:group/profile/access/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions
], profiles.getView);
router.delete('/:group/profile/access/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions
], profiles.deleteView);

// Secured Profile Requests
router.post('/:group/profile/request/:account_id', [
	m.validateAuthGroup,
	m.getGlobalPluginSettings,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions
], profiles.createRequest);
router.get('/:group/profile/requests/:sor', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions
], profiles.getRequests);
router.get('/:group/profile/request/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions
], profiles.getRequest);
router.delete('/:group/profile/request/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions
], profiles.deleteRequest);
router.patch('/:group/profile/request/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions
], profiles.updateRequestStatus);
// Secured Profiles
router.post('/:group/profile', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions
], profiles.writeProfile);
router.get('/:group/profile', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions
], profiles.getProfile);
router.get('/:group/profiles/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions
], profiles.getProfileById);
router.delete('/:group/profile', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions
], profiles.deleteProfile);
router.patch('/:group/profile', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions
], profiles.patchProfile);
// root only for get all - not implemented in swagger for now
router.get('/:group/profiles', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions
], profiles.getProfiles);

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