import express from 'express';
import org from '../api/orgs/api';
import dom from '../api/domains/api';
import invite from '../api/invites/api';
import client from '../api/oidc/client/api';
import plugins from '../api/plugins/api';
import access from '../api/oidc/access/api';
import m from '../middleware';

const router = express.Router();

async function PENDING(req, res, next) {
	res.json({ data: 'this API is not yet implemented but will be soon', requestDetails: {group: req.params.group, organization: req.params.org, domain: req.params.domain, id: req.params.id } })
}

// User Access
router.put('/:group/access/account/:id', PENDING);
router.get('/:group/access/account/:id', PENDING);
router.get('/:group/access/validate', PENDING);

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
router.get('/:group/organizations/:org/products', PENDING);
router.post('/:group/organizations/:org/products', PENDING);
router.get('/:group/organizations/:org/products/:id', PENDING);
router.patch('/:group/organizations/:org/products/:id', PENDING);
router.delete('/:group/organizations/:org/products/:id', PENDING);

// Products
router.get('/:group/products', PENDING);
router.post('/:group/products', PENDING);
router.get('/:group/products/:id', PENDING);
router.patch('/:group/products/:id', PENDING);
router.delete('/:group/products/:id', PENDING);
router.get('/:group/organizations/:org/products', PENDING);
router.post('/:group/organizations/:org/products', PENDING);

// Roles
router.get('/:group/products/:product/roles', PENDING);
router.post('/:group/products/:product/roles', PENDING);
router.get('/:group/products/:product/roles/:id', PENDING);
router.patch('/:group/products/:product/roles/:id', PENDING);
router.delete('/:group/products/:product/roles/:id', PENDING);
router.get('/:group/organizations/:org/products/:product/roles', PENDING);
router.post('/:group/organizations/:org/products/:product/roles', PENDING);

// Permissions
router.get('/:group/organization/:org/permissions', PENDING);
router.post('/:group/organization/:org/permissions', PENDING);
router.get('/:group/organization/:org/permissions/:id', PENDING);
router.delete('/:group/organization/:org/permissions/:id', PENDING);

module.exports = router;
