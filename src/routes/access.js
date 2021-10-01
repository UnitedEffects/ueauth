import express from 'express';
import org from '../api/orgs/api';
import dom from '../api/domains/api';
import prod from '../api/products/api';
import role from '../api/roles/api';
import user from '../api/accounts/api';
import perm from '../api/permissions/api';
import m from '../middleware';

const router = express.Router();

async function PENDING(req, res, next) {
	res.json({ data: 'this API is not yet implemented but will be soon', requestDetails: {group: req.params.group, organization: req.params.org, domain: req.params.domain, id: req.params.id } })
}

// User Access
router.put('/:group/access/organization/:org/account/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access
], user.defineAccess);
router.get('/:group/access/organization/:org/account/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access
], user.getDefinedAccess);
router.delete('/:group/access/organization/:org/account/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access
], user.removeOrgFromAccess);
router.get('/:group/access/account/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access
], user.getUserAccess);
router.get('/:group/access/validate', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access
], user.getUserAccess);

// Organizations
router.get('/:group/organizations', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access
], org.getOrgs);
router.post('/:group/organizations', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access
], org.writeOrg);
router.get('/:group/organizations/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access
], org.getOrg);
router.patch('/:group/organizations/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access
], org.patchOrg);
router.delete('/:group/organizations/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access
], org.deleteOrg);

// Domains
router.get('/:group/organizations/:org/domains', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access
], dom.getDomains);
router.post('/:group/organizations/:org/domains', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access
], dom.writeDomain);
router.get('/:group/organizations/:org/domains/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access
], dom.getDomain);
router.patch('/:group/organizations/:org/domains/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access
], dom.patchDomain);
router.delete('/:group/organizations/:org/domains/:id', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access
], dom.deleteDomain);

// Products
router.get('/:group/products', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access
], prod.getProducts);
router.post('/:group/products', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access
], prod.writeProduct);
router.get('/:group/products/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access
], prod.getProduct);
router.patch('/:group/products/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access
], prod.patchProduct);
router.delete('/:group/products/:id', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access
], prod.deleteProduct);

// Roles
router.get('/:group/products/:product/roles', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access
], role.getRoles);
router.post('/:group/products/:product/roles', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access
], role.writeRole);
router.get('/:group/products/:product/roles/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access
], role.getRole);
router.patch('/:group/products/:product/roles/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access
], role.patchRole);
router.delete('/:group/products/:product/roles/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access
], role.deleteRole);
// Roles Across Products
router.get('/:group/roles', [
	m.validateAuthGroup,
	m.isAuthenticated,
	m.permissions,
	m.access
], role.getAllRoles);
// Roles Across Products By Org
router.get('/:group/organization/:org/roles', [
	m.validateAuthGroup,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access
], role.getAllRolesAcrossProductsByOrg);
// custom roles
router.get('/:group/organizations/:org/products/:product/roles', [
	m.validateAuthGroup,
	m.validateProduct,
	m.validateOrganization,
	m.isAuthenticated,
	m.permissions,
	m.access
], role.getOrganizationRoles);
router.post('/:group/organizations/:org/products/:product/roles', [
	m.validateAuthGroup,
	m.validateProduct,
	m.validateOrganization,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access
], role.writeCustom);

// Permissions
router.get('/:group/products/:product/permissions', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access
], perm.getPermissions);
router.post('/:group/products/:product/permissions', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.schemaCheck,
	m.permissions,
	m.access
], perm.writePermission);
router.get('/:group/products/:product/permissions/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access
], perm.getPermission);
router.delete('/:group/products/:product/permissions/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access
], perm.deletePermission);

// Reference Checks
router.get('/:group/products/:product/permissions/:id/reference-check/role', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access
], perm.checkForRoles);
router.get('/:group/products/:product/reference-check/permissions', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access
], prod.checkForPermissions);

module.exports = router;
