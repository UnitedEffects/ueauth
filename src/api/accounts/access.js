import dal from './dal';
import Boom from '@hapi/boom';
import ueEvents from '../../events/ueEvents';
import dom from '../domains/domain';
import role from '../roles/roles';
import oidc from '../oidc/oidc';
import n from "../plugins/notifications/notifications";

const config = require('../../config');

const factory = {
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
	async defineAccess(ag, org, id, access, globalSettings, modifiedBy = 'SYSTEM_ADMIN') {
		// pull user record
		const authGroup = ag.id;
		const user = await dal.getAccount(authGroup, id);
		const organization = org.id;
		if(!user) throw Boom.notFound(`user not found: ${id}`);
		// make sure organization allows this email address domain
		let allowed = false;
		if (org && org.emailDomains && org.emailDomains.length !== 0) {
			org.emailDomains.map((d) => {
				if(user.email.includes(d)) allowed = true;
			});
		} else allowed = true;
		if(allowed === false) throw Boom.badRequest('This organization has restricted email domains', org.emailDomains);
		// check domains and roles
		const userAccess = user.access || [];
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
		let ogRecord;
		let recordIndex;
		userAccess.map((ac, index) => {
			if(ac.organization && ac.organization.id === organization) {
				ogRecord = ac;
				recordIndex = index;
			}
		});
		// Because this is a put, we will overwrite the entry
		const orgRecord = {
			organization: {
				id: organization,
				domains: access.domains,
				roles: access.roles,
				terms: (ogRecord && ogRecord.terms) ? ogRecord.terms : { required: false }
			}
		};
		// setting terms of access that must be accepted
		if(org.access && org.access.required === true) {
			if(!ogRecord || !ogRecord.terms || (ogRecord.terms && org.access.required && !ogRecord.terms.accepted) ||
				(ogRecord.terms && org.access.required && ogRecord.terms.accepted &&
					ogRecord.terms.termsVersion !== org.access.termsVersion)) {
				orgRecord.organization.terms = {
					required: true,
					accepted: false,
					termsDeliveredOn: Date.now(),
					termsOfAccess: org.access.terms,
					termsVersion: org.access.termsVersion,
					termsAcceptedOn: undefined
				};
			}
		}

		if (recordIndex === undefined) {
			userAccess.push(orgRecord);
		} else userAccess[recordIndex] = orgRecord;
		user.access = userAccess;
		user.modifiedBy = modifiedBy;
		user.modifiedAt = Date.now();
		const result = await user.save();
		if (globalSettings && globalSettings.notifications.enabled === true &&
			ag.pluginOptions.notification.enabled === true) {
			try {
				// we will attempt a notification
				const notificationObject = accessNotificationObject(ag, org.name, user, [], modifiedBy);
				await n.notify(globalSettings, notificationObject, ag);
			} catch (error) {
				ueEvents.emit(authGroup, 'ue.plugin.notification.error', { error });
			}
		}
		ueEvents.emit(authGroup, 'ue.access.defined', { sub: id, access: orgRecord });
		return result;
	},
	async getUserAccess(authGroup, id, query) {
		const user = await dal.getAccountByAccess(authGroup, id, query.org);
		if(!user) throw Boom.notFound(`user not found: ${id}`);
		console.info(user.access.organization);
		const userAccess = user.access || [];
		const response = {
			sub: id,
			authGroup: {
				id: authGroup.id,
				owner: (authGroup.owner === id),
				member: (user.authGroup === authGroup.id),
				memberPermissions: []
			},
			access: []
		};
		const condensed = {};
		let orgs = [];
		let domains = [];
		let products = [];
		let roles = [];
		let permissions = [];
		let miscRoles = [];
		for(let i=0; i<userAccess.length; i++) {
			let termsAllow = true;
			if(userAccess[i].organization && userAccess[i].organization.terms && userAccess[i].organization.terms.required === true) {
				if(userAccess[i].organization.terms.accepted !== true) termsAllow = false;
				if(!userAccess[i].organization.terms.termsAcceptedOn) termsAllow = false;
			}
			if (termsAllow === true) {
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
					if (domain) {
						if (query.domain) {
							if (domain.id === query.domain) {
								accessItem.organization.domainAccess.push(domain.id);
								domains.push(`${userAccess[i].organization.id}::${domain.id}`);
								if (query.product) {
									if (domain.associatedOrgProducts.includes(query.product)) {
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
							if (query.product) {
								if (domain.associatedOrgProducts.includes(query.product)) {
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
					if (rl) {
						if (accessItem.organization.productAccess.includes(rl.product)) {
							if (query.excludePermissions !== 'true' && query.excludePermissions !== true) {
								if (rl.permissions && rl.permissions.length !== 0) {
									if (!accessItem.organization.productPermissions) accessItem.organization.productPermissions = [];
									rl.permissions.map((val) => {
										const p = val.split(' ');
										if (p.length === 2) {
											const temp = accessItem.organization.productPermissions.filter((x) => {
												return x.id === p[0];
											});
											if (temp.length === 0) {
												accessItem.organization.productPermissions.push({
													id: p[0],
													code: p[1],
													product: rl.product
												});
												permissions.push(`${rl.productCodedId || rl.product}:::${p[1]}`);
											}
										}
									});
								}
							}
							accessItem.organization.productRoles.push({
								id: rl.id,
								name: rl.name,
								associatedProduct: rl.product
							});
							const rolePush = (rl.organization) ?
								`${rl.organization}::${rl.productCodedId || rl.product}::${rl.codedId}` :
								`${rl.productCodedId || rl.product}::${rl.codedId}`;
							roles.push(rolePush);
						} else if (query.includeMiscRoles === 'true' || query.includeMiscRoles === true) {
							if (!accessItem.organization.miscRoles) accessItem.organization.miscRoles = [];
							accessItem.organization.miscRoles.push({
								id: rl.id,
								name: rl.name,
								associatedProduct: rl.product,
							});
							const rolePush = (rl.organization) ?
								`${rl.organization}::${rl.productCodedId || rl.product}::${rl.codedId}` :
								`${rl.productCodedId || rl.product}::${rl.codedId}`;
							miscRoles.push(rolePush);
						}
					}
					return rl;
				}
				));
				// deduplicating the string arrays
				accessItem.organization.domainAccess = [...new Set(accessItem.organization.domainAccess)];
				accessItem.organization.productAccess = [...new Set(accessItem.organization.productAccess)];
				response.access.push(accessItem);
			}
		}
		// member...
		if(user.authGroup === authGroup.id) {
			config.MEMBER_PERMISSIONS.map((p) => {
				response.authGroup.memberPermissions.push(`${authGroup.id}-${p}`);
				permissions.push(`${authGroup.id}-${p}`);
			});
		}

		// dedup
		domains = [...new Set(domains)];
		products = [...new Set(products)];
		permissions = [...new Set(permissions)];

		if(query.minimized === 'true' || query.minimized === true) {
			condensed.sub = id;
			condensed.authGroup = response.authGroup.id;
			condensed.owner = response.authGroup.owner;
			condensed.member = response.authGroup.member;
			if(orgs.length !== 0) condensed.orgs = orgs.join(' ');
			if(domains.length !== 0) condensed.orgDomains = domains.join(' ');
			if(products.length !== 0) condensed.products = products.join(' ');
			if(roles.length !== 0) condensed.productRoles = roles.join(' ');
			if(permissions.length !== 0) condensed.permissions = permissions.join(' ');
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
		if (orgIndex === undefined && orgRecord) throw Boom.notFound(`Unexpected error finding organization ${organization} on user ${id}`);
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
	},
	async getAllOrgs(ag, id) {
		return dal.getAllOrgs(ag, id);
	},
	async checkOneUserOrganizations(ag, org, id) {
		return dal.checkOneUserOrganizations(ag, org, id);
	},
	async userActionOnOrgTerms(authGroup, organization, id, action) {
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
		if (orgIndex === undefined && orgRecord) throw Boom.notFound(`Unexpected error finding organization ${organization} on user ${id}`);
		if(!userAccess[orgIndex].organization.terms) return user;
		switch(action) {
		case 'accept':
			userAccess[orgIndex].organization.terms.accepted = true;
			userAccess[orgIndex].organization.terms.termsAcceptedOn = Date.now();
			user.access = userAccess;
			return user.save();
		case 'decline':
			return factory.removeOrgFromAccess(authGroup, organization, id);
		default:
			throw Boom.badRequest('Unknown action requested');
		}
	}
};

function accessNotificationObject(authGroup, organization, user, formats = [], activeUser = undefined) {
	const data = {
		iss: oidc(authGroup).issuer,
		createdBy: activeUser,
		type: 'general',
		formats,
		recipientUserId: user.id,
		recipientEmail: user.email,
		recipientSms: user.txt,
		screenUrl: `${config.UI_URL}`,
		subject: `Access Provided to ${organization} on ${authGroup.name}`,
		message: `You have been provided access to an organization called ${organization} within the ${authGroup.name} authentication network. This access allows you to access products or applications licensed and administrated by ${organization}. Please note that your access may require a 'terms of access' consent. If so, you can access your ${authGroup.name} authentication network profile by clicking the button and logging into the system. There you will be able to manage all of the organizations to which you've been provided access. If there is a terms of access notification for this organization you can accept or decline from there. Should you decline, the access will be revoked.`
	};
	if(formats.length === 0) {
		data.formats = [];
		if(user.email) data.formats.push('email');
		if(user.txt) data.formats.push('sms');
	}
	return data;
}

export default factory;