import { createQuery } from 'odata-v4-mongodb';
import Boom from '@hapi/boom';
import group from './api/authGroup/group';
import NodeCache from 'node-cache';
import org from '../src/api/orgs/orgs';
import dom from '../src/api/domains/domain';
import role from '../src/api/roles/roles';
import auth from "./auth/auth";

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
	async cacheAG(reset, prefix, id) {
		let result;
		const cache = (reset) ? undefined : await myCache.get(`${prefix}:${id}`);
		if(!cache) {
			result = await group.getOneByEither(id);
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
	async validateOrganizationReference (model, id, authGroup) {
		const result = await model.findOne({ _id: id, authGroup });
		return !!result;
	},
	async validateProductReference (model, id, authGroup) {
		const result = await model.findOne({ _id: id, authGroup });
		return !!result;
	},
	async validateDomainReference (model, id, authGroup, currentOrganizations) {
		const data = id.split(':');
		if(data.length !== 2) return false;
		if(!currentOrganizations.includes(data[0])) return false;
		const result = await model.findOne({ _id: data[1], authGroup, organization: data[0] });
		return !!result;
	},
	async validateOrgProductReference (model, orgId, authGroup, productId) {
		const result = await model.findOne({ _id: orgId, authGroup }).select( { associatedProducts: 1 });
		if(!result) return false;
		return (result.associatedProducts.includes(productId));
	},
	async validateAccessReferences(obj, authGroup) {
		if(!obj.organization) return false;
		if(!obj.organization.id) return false;
		const organization = await org.getOrg(authGroup, obj.organization.id);
		if(!organization) return false;
		let domCheck = true;
		let temp;
		if(obj.organization.domains && obj.organization.domains.length !== 0) {
			for(let i = 0; i<obj.organization.domains.length; i++) {
				temp = await dom.getDomain(authGroup, obj.organization.id, obj.organization.domains[i]);
				if(temp.id !== obj.organization.domains[i]) domCheck = false;
			}
		}
		if(domCheck === false) return false;
		let roleCheck = true;
		if(obj.organization.roles && obj.organization.roles.length !== 0) {
			for(let i = 0; i<obj.organization.roles.length; i++) {
				temp = await role.getRoleByOrganizationAndId(authGroup, obj.organization.id, obj.organization.roles[i]);
				if(temp.id !== obj.organization.roles[i]) roleCheck = false;
			}
		}
		if (roleCheck === false) return false;
		return true;
	}
};