import { createQuery } from 'odata-v4-mongodb';
import Boom from '@hapi/boom';
import group from './api/authGroup/group';
import NodeCache from 'node-cache';
import product from './api/products/product';
import orgs from './api/orgs/orgs';

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
		// these are restricted or trademarked names
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
			'ueauth',
			'uestreams',
			'ue-streams',
			'ue_auth',
			'ue_streams',
			'authenticate',
			'authorize',
			'oidc',
			'oauth',
			'oauth2',
			'group',
			'authgroup',
			'auth-group',
			'auth_group',
			'usergroup',
			'user-group',
			'user_group',
			'account',
			'logs',
			'client',
			'interaction',
			'health',
			'version',
			'groupcheck',
			'group-check',
			'group_check',
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
			'group',
			'core',
			'eos',
			'core-eos',
			'core_eos',
			'coreeos',
			'united_effects',
			'unitedeffects',
			'united-effects',
			'_united_effects_',
			'united_effects_',
			'_united_effects',
			'_unitedeffects_',
			'unitedeffects_',
			'_unitedeffects',
			'united_effect',
			'unitedeffect',
			'united-effect',
			'_united_effect_',
			'united_effect_',
			'_united_effect',
			'_unitedeffect_',
			'unitedeffect_',
			'_unitedeffect',
		];
		return protectedNamespaces.includes(x.toLowerCase());
	},
	async cacheCoreProduct(reset, authGroup) {
		let result;
		const cache = (reset) ? undefined : await myCache.get(`${authGroup.id}:CoreAdminPortal`);
		if(!cache) result = await product.getCoreProducts(authGroup);
		else result = JSON.parse(cache);
		if(!result) throw Boom.notFound('Core product for this AuthGroup was not identified. Contact the admin.');
		if (!cache) {
			await cacheThis(result, authGroup, 'CoreAdminPortal');
		}
		return result;
	},
	async cachePrimaryOrg(reset, authGroup) {
		let result;
		const cache = (reset) ? undefined : await myCache.get(`${authGroup.id}:PrimaryOrg`);
		if(!cache) result = await orgs.getPrimaryOrg(authGroup.id);
		else result = JSON.parse(cache);
		if(!result) throw Boom.notFound('Primary Org for this AuthGroup was not identified. Contact the admin.');
		if (!cache) {
			await cacheThis(result, authGroup, 'PrimaryOrg');
		}
		return result;
	},
	async getGlobalSettingsCache() {
		const cache = await myCache.get('globalSettings');
		if(cache) return JSON.parse(cache);
		return cache;
	},
	async setGlobalSettingsCache(data) {
		await myCache.set('globalSettings', JSON.stringify(data), 300);
	},
	// this is only used in the event factor and could be merged with the next method later
	async getAGFromCache(groupId) {
		let grp = myCache.get(`AG:${groupId}`);
		if(!grp) {
			grp = await group.getOneByEither(groupId);
			if(grp) {
				const holdThis = JSON.parse(JSON.stringify(grp));
				holdThis._id = grp._id;
				holdThis.owner = grp.owner;
				holdThis.active = grp.active;
				myCache.set(`AG:${groupId}`, JSON.stringify(holdThis), 300);
			}
		}
		return (this.isJson(grp)) ? JSON.parse(grp) : grp;
	},
	async cacheAG(reset, prefix, id, mustBeActive = true) {
		let result;
		const cache = (reset) ? undefined : await myCache.get(`${prefix}:${id}`);
		if(!cache) {
			result = await group.getOneByEither(id, mustBeActive);
		} else {
			result = JSON.parse(cache);
		}
		if (!result) {
			throw Boom.notImplemented('auth group not found');
		}
		if (!cache) {
			const holdThis = JSON.parse(JSON.stringify(result));
			holdThis._id = result._id;
			holdThis.owner = result.owner;
			holdThis.active = result.active;
			await myCache.set(`${prefix}:${id}`, JSON.stringify(holdThis), 300);
		}
		return result;
	},

	async validatePermissionReference(model, v, authGroup, product) {
		const val = v.split(' ');
		if(val.length !== 2) return false;
		const result = await model.findOne({ _id: val[0], coded: val[1], authGroup, product });
		return !!result;
	},
	async validateProductReference (model, id, authGroup, core = false) {
		const result = await model.findOne({ _id: id, authGroup });
		if (result && result.meta && result.meta.core === 'groupAdmin' ) {
			if(core === false) return false;
		}
		return !!result;
	},
	async validateClientReference (model, id, authGroup) {
		if(id) {
			const result = await model.findOne({ _id: id, 'payload.auth_group': authGroup });
			return !!result;
		}
		return true;
	},
	async validateAccountReference(model, id, authGroup, org) {
		const result = await model.findOne({ _id: id, authGroup, access: { $elemMatch: { 'organization.id': org }}});
		return !!result;
	},
	async validateOrgProductReference (model, orgId, authGroup, productId) {
		const result = await model.findOne({ _id: orgId, authGroup }).select( { associatedProducts: 1 });
		if(!result) return false;
		return (result.associatedProducts.includes(productId));
	}
};

async function cacheThis(data, authGroup, key) {
	const holdThis = JSON.parse(JSON.stringify(data));
	holdThis._id = data._id;
	holdThis.core = data.core;
	await myCache.set(`${authGroup.id}:${key}`, JSON.stringify(holdThis), 3600);
}