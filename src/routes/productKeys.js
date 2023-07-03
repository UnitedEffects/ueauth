import express from 'express';
import key from '../api/oidc/productKeys/api';
import m from '../middleware';

const router = express.Router();

// Product Key Services (clients)
router.post('/:group/access/product/:product/key/service', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('productKey')
], key.initializeProductKeyClient);
router.delete('/:group/access/product/:product/key/service/:clientId', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('productKey')
], key.removeProductKeyClient);
router.put('/:group/access/product/:product/key/service/:clientId', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('productKey')
], key.updateProductKeyClientRoles);
router.get('/:group/access/product/:product/key/service', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('productKey')
], key.showProductKeyClients);


// Product Keys
router.post('/:group/access/product/:product/key', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('productKey')
], key.createKey);
router.get('/:group/access/product/:product/key', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('productKey')
], key.getKeys);
router.put('/:group/access/product/:product/key/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('productKey')
], key.refreshKey);
router.delete('/:group/access/product/:product/key/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('productKey')
], key.removeKey);
router.get('/:group/access/product/:product/key/:id', [
	m.validateAuthGroup,
	m.validateProduct,
	m.isAuthenticated,
	m.permissions,
	m.access('productKey')
], key.getKey);


export default router;
