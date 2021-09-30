import dal from './dal';
import helper from '../../helper';
import iat from '../oidc/initialAccess/iat';
import n from '../plugins/notifications/notifications';
import Boom from '@hapi/boom';
import ueEvents from '../../events/ueEvents';
import dom from '../domains/domain';
import role from '../roles/roles';

const config = require('../../config');

export default {
	async getDefinedAccess(authGroup, organization, id) {
		const user = await dal.getAccount(authGroup, id);
		if (!user) throw Boom.notFound(`user not found: ${id}`);
		const userAccess = user.access || [];
		let orgRecord;
		userAccess.map((ac) => {
			if (ac.organization && ac.organization.id === organization) {
				orgRecord = ac;
			}
		});
		if (!orgRecord) throw Boom.notFound(`No access record for organization ${organization} on user ${id}`);
		return {
			domains: orgRecord.organization.domains,
			roles: orgRecord.organization.roles
		};
	},
	async defineAccess(authGroup, organization, id, access) {
		// pull user record
		const user = await dal.getAccount(authGroup, id);
		if(!user) throw Boom.notFound(`user not found: ${id}`);
		const userAccess = user.access || [];
		// check domains and roles
		if(!access.domains || !Array.isArray(access.domains)) access.domains = [];
		if(!access.roles || !Array.isArray(access.roles)) access.roles = [];
		let badDomains = [];
		let badRoles = [];
		const domMap = access.domains.map(async (id) => {
			const temp = await dom.getDomain(authGroup, organization, id);
			if(!temp) badDomains.push(id);
			return temp;
		});
		const roleMap = access.roles.map(async (id) => {
			const temp = await role.getRoleByOrganizationAndId(authGroup, organization, id);
			if(!temp) badRoles.push(id);
			return temp;
		});
		await Promise.all([...domMap, ...roleMap]);
		if(badDomains.length !== 0 || badRoles.length !== 0) {
			throw Boom.badRequest('The following roles or domains do not exist in the organization', { domains: badDomains, roles: badRoles });
		}
		let orgRecord;
		let recordIndex;
		userAccess.map((ac, index) => {
			if(ac.organization && ac.organization.id === organization) {
				orgRecord = ac;
				recordIndex = index;
			}
		});
		// Because this is a put, we will overwrite the entry
		orgRecord = {
			organization: {
				id: organization,
				domains: access.domains,
				roles: access.roles
			}
		};
		userAccess[recordIndex] = orgRecord;
		user.access = userAccess;
		ueEvents.emit(authGroup, 'ue.access.defined', { sub: id, access: orgRecord });
		return user.save();
	},
	async getUserAccess(authGroup, id, query) {
		//const user = await dal.getAccount(authGroup, id);
		const user = await dal.getAccountByAccess(authGroup, id, query.org);
		if(!user) throw Boom.notFound(`user not found: ${id}`);
		const userAccess = user.access || [];
		const response = {
		    sub: id,
			authGroup: {
				id: authGroup.id,
				owner: (authGroup.owner === id),
				member: (user.authGroup === authGroup.id)
			},
			access: []
		};
		const condensed = {};
		let orgs = [];
		let domains = [];
		let products = [];
		let roles = [];
		let miscRoles = [];
		for(let i=0; i<userAccess.length; i++) {
			orgs.push(userAccess[i].organization.id);
			const accessItem = {
				organization: {
					id: userAccess[i].organization.id,
					domainAccess: [],
					productAccess: [],
					productRoles: []
				}
			};
			await Promise.all(userAccess[i].organization.domains.map(async (d) => {
				const domain = await dom.getDomain(authGroup, userAccess[i].organization.id, d);
				if(domain) {
				    if(query.domain) {
				    	if (domain.id === query.domain) {
							accessItem.organization.domainAccess.push(domain.id);
							domains.push(`${userAccess[i].organization.id}::${domain.id}`);
							if (query.product) {
								if(domain.associatedOrgProducts.includes(query.product)) {
									accessItem.organization.productAccess = accessItem.organization.productAccess.concat([query.product]);
									products = products.concat([query.product]);
								}
							} else {
								accessItem.organization.productAccess =
									accessItem.organization.productAccess.concat(domain.associatedOrgProducts);
								products = products.concat(domain.associatedOrgProducts);
							}
						}
                    } else {
                        accessItem.organization.domainAccess.push(domain.id);
						domains.push(`${userAccess[i].organization.id}::${domain.id}`);
						if(query.product) {
							if(domain.associatedOrgProducts.includes(query.product)) {
								accessItem.organization.productAccess = accessItem.organization.productAccess.concat([query.product]);
								products = products.concat([query.product]);
							}
						} else {
							accessItem.organization.productAccess = accessItem.organization.productAccess.concat(domain.associatedOrgProducts);
							products = products.concat(domain.associatedOrgProducts);
						}
                    }
				}
				return domain;
			}));
			await Promise.all(userAccess[i].organization.roles.map(async (r) => {
				const rl = await role.getRoleByOrganizationAndId(authGroup, userAccess[i].organization.id, r);
				if(rl) {
					if(accessItem.organization.productAccess.includes(rl.product)) {
						accessItem.organization.productRoles.push({
							id: rl.id,
							name: rl.name,
							associatedProduct: rl.product
						});
						const rolePush = (rl.organization) ?
							`${rl.organization}::${rl.productCodedId || rl.product}::${rl.codedId}` :
							`${rl.productCodedId || rl.product}::${rl.codedId}`;
						roles.push(rolePush);
					} else if(query.includeMiscRoles === 'true' || query.includeMiscRoles === true) {
						if(!accessItem.organization.miscRoles) accessItem.organization.miscRoles = [];
						accessItem.organization.miscRoles.push({
							id: rl.id,
							name: rl.name,
							associatedProduct: rl.product
						});
						const rolePush = (rl.organization) ?
							`${rl.organization}::${rl.productCodedId || rl.product}::${rl.codedId}` :
							`${rl.productCodedId || rl.product}::${rl.codedId}`;
						miscRoles.push(rolePush);
					}
				}
				return rl;
			}));
			// deduplicating the string arrays
			accessItem.organization.domainAccess = [...new Set(accessItem.organization.domainAccess)];
			domains = [...new Set(domains)];
			accessItem.organization.productAccess = [...new Set(accessItem.organization.productAccess)];
			products = [...new Set(products)];
			response.access.push(accessItem);
		}
		if(query.minimized === 'true' || query.minimized === true) {
            condensed.sub = id;
            condensed.authGroup = response.authGroup.id;
            condensed.owner = response.authGroup.owner;
            condensed.member = response.authGroup.member;
            if(orgs.length !== 0) condensed.orgs = orgs.join(' ');
            if(domains.length !== 0) condensed.orgDomains = domains.join(' ');
            if(products.length !== 0) condensed.products = products.join(' ');
            if(roles.length !== 0) condensed.productRoles = roles.join(' ');
            if(miscRoles.length !== 0) condensed.miscRoles = miscRoles.join(' ');
            return condensed;
		}
		return response;
	},
	async removeOrgFromAccess (authGroup, organization, id) {
		const user = await dal.getAccount(authGroup, id);
		if (!user) throw Boom.notFound(`user not found: ${id}`);
		const userAccess = user.access || [];
		let orgRecord;
		let orgIndex;
		if(userAccess.length === 0) throw Boom.notFound(`No access record for organization ${organization} on user ${id}`);
		userAccess.map((ac, index) => {
			if (ac.organization && ac.organization.id === organization) {
				orgRecord = ac;
				orgIndex = index;
			}
		});
		if (!orgRecord) throw Boom.notFound(`No access record for organization ${organization} on user ${id}`);
		if (!orgIndex && orgRecord) throw Boom.notFound(`Unexpected error finding organization ${organization} on user ${id}`);
		userAccess.splice(orgIndex, 1);
		user.access = userAccess;
		return user.save();
	},
	async checkOrganizations(ag, orgId) {
		const result = await dal.checkOrganizations(ag, orgId);
		if(result.length === 0) return false;
		return result;
	},
	async checkDomains(ag, orgId, id) {
		const result = await dal.checkDomains(ag, orgId, id);
		if(result.length === 0) return false;
		return result;
	},
	async checkRoles(ag, id) {
		const result = await dal.checkRoles(ag, id);
		if(result.length === 0) return false;
		return result;
	}

};