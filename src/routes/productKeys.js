import express from 'express';
import key from '../api/oidc/productKeys/api';
import m from '../middleware';

const router = express.Router();

// Product Key Access
router.post('/:group/access/product/:product/key/service', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('clientAccess')
], key.initializeProductKeyClient);
router.delete('/:group/access/product/:product/key/service/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('clientAccess')
], key.removeProductKeyClient);
router.get('/:group/access/product/:product/key/service', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('clientAccess')
], key.showProductKeyClients);

router.post('/:group/access/product/:product/key', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('clientAccess')
], key.createKey);
router.get('/:group/access/product/:product/key', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('clientAccess')
], key.getKeys);
router.put('/:group/access/product/:product/key/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('clientAccess')
], key.refreshKey);
router.delete('/:group/access/product/:product/key/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('clientAccess')
], key.removeKey);
router.get('/:group/access/product/:product/key/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('clientAccess')
], key.getKey);


export default router;
