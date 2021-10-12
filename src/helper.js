import { createQuery } from 'odata-v4-mongodb';
import Boom from '@hapi/boom';
import group from './api/authGroup/group';
import NodeCache from 'node-cache';
import product from "./api/products/product";

const myCache = new NodeCache();
const jwtCheck = /^([A-Za-z0-9\-_~+\/]+[=]{0,2})\.([A-Za-z0-9\-_~+\/]+[=]{0,2})(?:\.([A-Za-z0-9\-_~+\/]+[=]{0,2}))?$/;

export default {
	/**
     * Checks string to see if its JSON
     * @param check
     * @returns {boolean}
     */
	isJson(check) {
		try {
			JSON.parse(check);
			return true;
		} catch (e) {
			return false;
		}
	},
	isJWT(str) {
		return jwtCheck.test(str);
	},
	elementExists(property, check, arr) {
		return arr.some((el) => {
			return el[property] === check;
		});
	},
	async parseOdataQuery (data) {
		try {
			let query = null;
			if (data.$filter) {
				query = (query === null) ? `$filter=${data.$filter}` : `${query}&$filter=${data.$filter}`;
			}
			if (data.$select) {
				query = (query === null) ? `$select=${data.$select}` : `${query}&$select=${data.$select}`;
			}
			if (data.$skip) {
				query = (query === null) ? `$skip=${data.$skip}` : `${query}&$skip=${data.$skip}`;
			}
			if (data.$top) {
				query = (query === null) ? `$top=${data.$top}` : `${query}&$top=${data.$top}`;
			}
			if (data.$orderby) {
				query = (query === null) ? `$orderby=${data.$orderby}` : `${query}&$orderby=${data.$orderby}`;
			}
			return createQuery(query);
		} catch (error) {
			throw Boom.badRequest('Check your oData inputs', data);
		}

	},
	protectedNames(x) {
		const protectedNamespaces = [
			'api',
			'css',
			'js',
			'fonts',
			'favicon.ico',
			'swagger',
			'swagger.json',
			'ueauth',
			'auth',
			'ue-auth',
			'authenticate',
			'authorize',
			'oidc',
			'oauth',
			'oauth2',
			'group',
			'authgroup',
			'auth-group',
			'usergroup',
			'user-group',
			'account',
			'logs',
			'client',
			'interaction',
			'health',
			'version',
			'groupcheck',
			'group-check',
			'login',
			'logout',
			'access',
			'token',
			'reg',
			'registration',
			'certs',
			'session',
			'me',
			'device',
			'introspection',
			'operation',
			'group'
		];
		return protectedNamespaces.includes(x.toLowerCase());
	},
	async cacheCoreProduct(reset, authGroup) {
		let result;
		const cache = (reset) ? undefined : await myCache.get(`${authGroup.id}:CoreAdminPortal`);
		if(!cache) {
			result = await product.getCoreProducts(authGroup);
		} else {
			result = JSON.parse(cache);
		}
		if(!result) throw Boom.notFound('Core product for this AuthGroup was not identified. Contact the admin.');
		if (!cache) {
			const holdThis = JSON.parse(JSON.stringify(result));
			holdThis._id = result._id;
			holdThis.core = result.core;
			await myCache.set(`${authGroup.id}:CoreAdminPortal`, JSON.stringify(holdThis), 86400);
		}
		return result;
	},
	async cacheAG(reset, prefix, id, mustBeActive = true) {
		let result;
		const cache = (reset) ? undefined : await myCache.get(`${prefix}:${id}`);
		if(!cache) {
			result = await group.getOneByEither(id, mustBeActive);
		} else {
			result = JSON.parse(cache);
		}
		if (!result) throw Boom.notFound('auth group not found');
		if (!cache) {
			const holdThis = JSON.parse(JSON.stringify(result));
			holdThis._id = result._id;
			holdThis.owner = result.owner;
			holdThis.active = result.active;
			await myCache.set(`${prefix}:${id}`, JSON.stringify(holdThis), 3600);
		}
		return result;
	},

	async validatePermissionReference(model, v, authGroup, product) {
		const val = v.split(' ');
		if(val.length !== 2) return false;
		const result = await model.findOne({ _id: val[0], coded: val[1], authGroup, product });
		return !!result;
	},
	async validateProductReference (model, id, authGroup) {
		const result = await model.findOne({ _id: id, authGroup });
		return !!result;
	},
	async validateOrgProductReference (model, orgId, authGroup, productId) {
		const result = await model.findOne({ _id: orgId, authGroup }).select( { associatedProducts: 1 });
		if(!result) return false;
		return (result.associatedProducts.includes(productId));
	}
};