import express from 'express';
import org from '../api/orgs/api';
import dom from '../api/domains/api';
import prod from '../api/products/api';
import role from '../api/roles/api';
import user from '../api/accounts/api';
import perm from '../api/permissions/api';
import m from '../middleware';

const router = express.Router();

// User Access
router.put('/:group/access/organization/:org/account/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('organization')
], user.defineAccess);
router.get('/:group/access/organization/:org/account/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('organization')
], user.getDefinedAccess);
router.delete('/:group/access/organization/:org/account/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('userAccess')
], user.removeOrgFromAccess);
router.get('/:group/access/account/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access('userAccess')
], user.getUserAccess);
router.get('/:group/access/validate', [
	m.validateAuthGroup,
	m.isAuthenticated
], user.getUserAccess);

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
	m.access('organizations')
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
	m.access('domains')
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
	m.access('domains')
], dom.getDomain);
router.patch('/:group/organizations/:org/domains/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access('domains')
], dom.patchDomain);
router.delete('/:group/organizations/:org/domains/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('domains')
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

// Roles Across Products By Org
router.get('/:group/organization/:org/roles', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access('roles')
], role.getAllRolesAcrossProductsByOrg);

// custom roles
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

// Permissions
router.get('/:group/products/:product/permissions', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], perm.getPermissions);
router.post('/:group/products/:product/permissions', [
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
router.delete('/:group/products/:product/permissions/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], perm.deletePermission);

// Reference Checks
router.get('/:group/products/:product/permissions/:id/reference-check/role', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('role')
], perm.checkForRoles);
router.get('/:group/products/:product/reference-check/permissions', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('permissions')
], prod.checkForPermissions);

module.exports = router;
