import express from 'express';
import org from '../api/orgs/api';
import dom from '../api/domains/api';
import prod from '../api/products/api';
import role from '../api/roles/api';
import user from '../api/accounts/api';
import perm from '../api/permissions/api';
import client from '../api/oidc/client/api';
import notify from '../api/plugins/api';
import m from '../middleware';

const router = express.Router();

// Access Functional
router.get('/:group/checkforupdates', [
	m.validateAuthGroup
], prod.getCoreProductMetaData);
router.put('/:group/updatecore', [
	m.validateAuthGroup
], prod.updateCoreProduct);

// User Access
router.put('/:group/access/organization/:org/account/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.getGlobalPluginSettings,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('organizations')
], user.defineAccess);
router.get('/:group/access/organization/:org/account/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('organizations')
], user.getDefinedAccess);
router.delete('/:group/access/organization/:org/account/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts', 'organization')
], user.removeOrgFromAccess);

router.put('/:group/access/organization/:org/accounts', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('organizations')
], user.bulkAddAccessToAccounts);
router.delete('/:group/access/organization/:org/accounts', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('accounts', 'organization')
], user.bulkRemoveAccessToAccounts);

router.get('/:group/access/organizations', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts')
], user.getAllOrgs);
router.get('/:group/access/my/organizations', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts')
], org.getMyOrgs);
router.get('/:group/access/my/organizations/:org/products', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts')
], prod.getMyProducts);
router.get('/:group/access/my/notifications', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts')
], notify.getMyNotifications);
router.get('/:group/access/my/notification/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts')
], notify.getMyNotification);
router.put('/:group/access/organizations/:org/terms', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('accounts')
], user.acceptOrDeclineOrgTerms);
router.get('/:group/access/account/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('userAccess')
], user.getUserAccess);

// Client Access
router.put('/:group/access/client/:id/product/:product', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('clientAccess')
], client.applyClientAccess);
router.delete('/:group/access/client/:id/product/:product', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('clientAccess')
], client.removeClientAccess);
router.get('/:group/access/client/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('clientAccess')
], client.getClientAccess);

// Access Validation - both users and clients
router.get('/:group/access/validate', [
	m.validateAuthGroup,
	m.isOIDCValid
], client.validateAccess);


// Organizations
router.get('/:group/organizations', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('organizations')
], org.getOrgs);
router.post('/:group/organizations', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('organizations')
], org.writeOrg);
router.get('/:group/organizations/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('organizations')
], org.getOrg);
router.patch('/:group/organizations/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('organizations', 'limited')
], org.patchOrg);
router.delete('/:group/organizations/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('organizations')
], org.deleteOrg);

// Domains
router.get('/:group/organizations/:org/domains', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('domains', 'limited')
], dom.getDomains);
router.post('/:group/organizations/:org/domains', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('domains')
], dom.writeDomain);
router.get('/:group/organizations/:org/domains/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('domains', 'limited')
], dom.getDomain);
router.patch('/:group/organizations/:org/domains/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('domains', 'limited')
], dom.patchDomain);
router.delete('/:group/organizations/:org/domains/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('domains', 'limited')
], dom.deleteDomain);

// Products
router.get('/:group/products', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('products')
], prod.getProducts);
router.post('/:group/products', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('products')
], prod.writeProduct);
router.get('/:group/products/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('products')
], prod.getProduct);
router.patch('/:group/products/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('products')
], prod.patchProduct);
router.delete('/:group/products/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('products')
], prod.deleteProduct);

// Organization Products
router.get('/:group/organization/:org/products', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('products')
], prod.getOrgProducts);
router.get('/:group/organization/:org/products/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('products')
], prod.getOrgProduct);
router.get('/:group/organization/:org/domain/:domain/products', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.validateDomain,
	m.isAuthenticated,
	m.permissions,
	m.access('products')
], prod.getOrgDomainProducts);
router.get('/:group/organization/:org/domain/:domain/products/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.validateDomain,
	m.isAuthenticated,
	m.permissions,
	m.access('products')
], prod.getOrgDomainProduct);

// Roles
router.get('/:group/products/:product/roles', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('roles')
], role.getRoles);
router.post('/:group/products/:product/roles', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('roles')
], role.writeRole);
router.get('/:group/products/:product/roles/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('roles')
], role.getRole);
router.patch('/:group/products/:product/roles/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('roles')
], role.patchRole);
router.delete('/:group/products/:product/roles/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('roles')
], role.deleteRole);

// Roles Across Products
router.get('/:group/roles', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('roles')
], role.getAllRoles);

// Roles By Org (custom)
router.get('/:group/organization/:org/roles', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('roles')
], role.getAllRolesAcrossProductsByOrg);
router.get('/:group/organizations/:org/products/:product/roles', [
	m.validateAuthGroup,
	m.validateProduct,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('roles')
], role.getOrganizationRoles);
router.put('/:group/organizations/:org/products/:product/roles', [
	m.validateAuthGroup,
	m.validateProduct,
	m.validateOrganization,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('roles')
], role.writeCustom);
router.get('/:group/organizations/:org/products/:product/roles/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('roles')
], role.getOrganizationRole);
router.delete('/:group/organizations/:org/products/:product/roles/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('roles')
], role.deleteOrganizationRole);
router.patch('/:group/organizations/:org/products/:product/roles/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.validateOrganization,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('roles')
], role.patchOrganizationRole);

// Permissions
router.get('/:group/products/:product/permissions', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], perm.getPermissions);
router.post('/:group/products/:product/permission', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('permissions')
], perm.writePermission);
router.get('/:group/products/:product/permissions/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], perm.getPermission);
router.delete('/:group/products/:product/permissions', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], perm.bulkDelete);
router.post('/:group/products/:product/permissions', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('permissions')
], perm.bulkAdd);
router.delete('/:group/products/:product/permissions/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], perm.deletePermission);
router.get('/:group/products/:product/roles/:role/permissions', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], role.getPermissionsInRole);

// Organization Permissions
router.get('/:group/organization/:org/products/:product/permissions', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], perm.getOrgPermissions);
router.get('/:group/organization/:org/products/:product/permissions/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], perm.getOrgPermission);
router.get('/:group/organization/:org/products/:product/roles/:role/permissions', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], role.getOrgPermissionsInRole);

// Permission Functional
router.get('/:group/products/:product/permission/targets', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], perm.getTargetsOrActions('target'));
router.get('/:group/products/:product/permission/actions', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], perm.getTargetsOrActions('action'));
router.get('/:group/products/:product/permission/tags', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], perm.getTags);

// Reference Checks
router.get('/:group/products/:product/permissions/:id/reference-check/role', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('roles')
], perm.checkForRoles);
router.get('/:group/products/:product/reference-check/permissions', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], prod.checkForPermissions);

export default router;
