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
	async createAccess(authGroup, organization, id, access) {
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
		// craft update
		// if nothing is found, simply add it to the array
		if(!orgRecord) {
			orgRecord = {
				organization: {
					id: organization,
					domains: access.domains,
					roles: access.roles
				}
			};
			userAccess.push(orgRecord);
			user.access = userAccess;
		} else {
			// otherwise lets concat and dedup the values of domain and roles
			if(!orgRecord.organization.domains) orgRecord.organization.domains = [];
			if(!orgRecord.organization.roles) orgRecord.organization.roles = [];
			orgRecord.organization.domains = orgRecord.organization.domains.concat(access.domains);
			orgRecord.organization.domains = [...new Set(orgRecord.organization.domains)];
			orgRecord.organization.roles = orgRecord.organization.roles.concat(access.roles);
			orgRecord.organization.roles = [...new Set(orgRecord.organization.roles)];
			userAccess[recordIndex] = orgRecord;
			user.access = userAccess;
		}
		ueEvents.emit(authGroup, 'ue.access.create', { sub: id, access: orgRecord });
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
		if(userAccess.length === 0) return response;
		for(let i=0; i<userAccess.length; i++) {
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
				        if(domain.id === query.domain) {
                            accessItem.organization.domainAccess.push(domain.id);
                            accessItem.organization.productAccess = accessItem.organization.productAccess.concat(domain.associatedOrgProducts);
                        }
                    } else {
                        accessItem.organization.domainAccess.push(domain.id);
                        accessItem.organization.productAccess = accessItem.organization.productAccess.concat(domain.associatedOrgProducts);
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
					} else {
					    if(query.includeMiscRoles === 'true' || query.includeMiscRoles === true) {
					        if(!accessItem.organization.miscRoles) accessItem.organization.miscRoles = [];
                            accessItem.organization.miscRoles.push({
                                id: rl.id,
                                name: rl.name,
                                associatedProduct: rl.product
                            });
                        }
					}
				}
				return rl;
			}));
			// deduplicating the string arrays
			accessItem.organization.domainAccess = [...new Set(accessItem.organization.domainAccess)];
			accessItem.organization.productAccess = [...new Set(accessItem.organization.productAccess)];
			response.access.push(accessItem);
		}
		if(query.minimized === 'true' || query.minimized === true) {
		    const condensed = {};
		    let orgs = [];
		    let domains = [];
		    let products = [];
		    let roles = [];
		    let miscRoles = [];
            response.access.map((o) => {
                if(o.organization) {
                    const org = o.organization;
                    if(org.id) {
                        orgs.push(org.id);
                    }
                    if(org.domainAccess) {
                        org.domainAccess.map((d) => {
                            domains.push(`${org.id}::${d}`);
                        });
                    }
                    if(org.productAccess) {
                        products = products.concat(org.productAccess);
                    }
                    if(org.productRoles) {
                        org.productRoles.map((r) => {
                            roles.push(`${r.associatedProduct}::${r.id}`);
                        });
                    }
                    if(org.miscRoles) {
                        org.miscRoles.map((r) => {
                            miscRoles.push(`${r.associatedProduct}::${r.id}`);
                        });
                    }
                }

            });
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
	}
};