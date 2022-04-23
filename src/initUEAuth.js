import { nanoid } from 'nanoid';
import orgs from './api/orgs/orgs';
import product from './api/products/product';
import domain from './api/domains/domain';
import perm from './api/permissions/permissions';
import roles from './api/roles/roles';
import access from './api/accounts/access';
const permArray = require('../init/groupAdminPermissions.json');
const permOrgArray = require('../init/orgProductPermissions.json');
const coreRoles = require('../init/roles.json');
const coreVersion = require('../init/currentCore.json');

export default {
	async createDefaultOrgAndDomain(authGroup, creator) {
		let initOrg;
		let initDomain;
		let initProductAdmin;
		let initProductOrg;
		let initRolesAdmin;
		let initRolesOrg;
		let initUserAccess;
		let permissionsAdmin;
		let permissionsOrg;
		let bulkPermWrite = [];
		let bulkPermOrgWrite = [];
		try {
			const meta = JSON.parse(JSON.stringify(coreVersion));
			delete meta.force;
			const agMeta = { ...meta, core: 'groupAdmin'};
			const ogMeta = { ...meta, core: 'orgAdmin' };
			const defaultProduct1 = {
				name: `${authGroup.name} - Super Admin Portal`,
				description: `This is a 'super admin' portal to manage the '${authGroup.name}' platform itself. Add users to this product to manage your customers, organizations, products, permissions, etc. Do not add your customers to this product. Do not delete as system access will be compromised.`,
				authGroup: authGroup.id,
				type: 'global',
				createdBy: creator.id,
				meta: agMeta,
				associatedClients: [authGroup.associatedClient],
				core: true
			};
			meta.core = 'orgAdmin';
			const defaultProduct2 = {
				name: `${authGroup.name} - Customer Portal`,
				description: `This is a portal for customers or other groups to self manage their organizations within the '${authGroup.name}' platform. Add users to this product so they can self service management of their organization. Do not delete as system access will be compromised.`,
				authGroup: authGroup.id,
				type: 'global',
				createdBy: creator.id,
				meta: ogMeta,
				associatedClients: [authGroup.associatedClient],
				core: true
			};
			initProductAdmin = await product.writeProduct(defaultProduct1);
			if(!initProductAdmin) throw new Error('Could not initialize platform product for AuthGroup admins');
			initProductOrg = await product.writeProduct(defaultProduct2);
			if(!initProductOrg) throw new Error('Could not initialize platform product for organization admins');
			permArray.map((p) => {
				if(!p.DEPRECATED) {
					p.description = `${authGroup.name} - Super Admin Portal Permission. System Created. DO NOT DELETE`;
					p.product = initProductAdmin.id;
					p.authGroup = authGroup.id;
					p.tags = ['ag-portal'];
					bulkPermWrite.push(p);
				}
			});
			permOrgArray.map((p) => {
				if(!p.DEPRECATED) {
					p.description = `${authGroup.name} - Customer Portal Permission. System Created. DO NOT DELETE`;
					p.product = initProductOrg.id;
					p.authGroup = authGroup.id;
					p.tags = ['org-portal'];
					bulkPermOrgWrite.push(p);
				}
			});
			permissionsAdmin = await perm.bulkWrite(authGroup.id, bulkPermWrite);
			permissionsOrg = await perm.bulkWrite(authGroup.id, bulkPermOrgWrite);
			const defaultOrg = {
				name: `${authGroup.name} Platform Admin`,
				description: `Internal '${authGroup.name}' platform super administration organization. Do not delete as system access will be compromised.`,
				type: 'internal',
				createdBy: creator.id,
				authGroup: authGroup.id,
				contactEmail: creator.email,
				associatedProducts: [initProductAdmin.id],
				core: true
			};
			initOrg = await orgs.writeOrg(authGroup.id, defaultOrg);
			if(!initOrg) throw new Error('Could not initialize primary organization');
			const defaultDom = {
				name: `${authGroup.name} Primary Domain`,
				description: `Primary domain of organization '${initOrg.name}'. Add your users to this domain to give them the ability to access the Super Admin Portal. Do not delete as system access will be compromised.`,
				authGroup: authGroup.id,
				organization: initOrg.id,
				createdBy: creator.id,
				associatedOrgProducts: initOrg.associatedProducts,
				meta: {
					admin: initOrg.id
				},
				core: true
			};
			initDomain = await domain.writeDomain(defaultDom);
			if(!initDomain) throw new Error('Could not initialize primary domain');
			const defaultRolesAdmin = [];
			const defaultRolesOrg = [];
			const AGAdminRoles = coreRoles.groupAdminPortal;
			const OrgAdminRoles = coreRoles.orgAdminPortal;
			AGAdminRoles.map((rl) => {
				const temp = {};
				temp.name = rl.role;
				temp.createdBy = creator.id;
				temp.authGroup = authGroup.id;
				temp.description = (!rl.description) ? `${authGroup.name} Super Admin Portal Role. System Generated. Do Not Delete` : rl.description;
				temp.product = initProductAdmin.id;
				temp.productCodedId = initProductAdmin.codedId;
				temp.core = true;
				temp.permissions = [];
				temp.codedId = nanoid(10);
				rl.permissions.map((p) => {
					const found = permissionsAdmin.filter((list) => {
						return list.coded === p.toLowerCase();
					});
					temp.permissions.push(`${found[0].id} ${found[0].coded}`);
				});
				temp.permissions = [...new Set(temp.permissions)];
				defaultRolesAdmin.push(temp);
			});
			OrgAdminRoles.map((rl) => {
				const temp = {};
				temp.name = rl.role;
				temp.createdBy = creator.id;
				temp.authGroup = authGroup.id;
				temp.description = (!rl.description) ? `${authGroup.name} Customer Portal Role. System Generated. Do Not Delete` : rl.description;
				temp.product = initProductOrg.id;
				temp.productCodedId = initProductOrg.codedId;
				temp.core = true;
				temp.permissions = [];
				temp.codedId = nanoid(10);
				rl.permissions.map((p) => {
					const found = permissionsOrg.filter((list) => {
						return list.coded === p.toLowerCase();
					});
					temp.permissions.push(`${found[0].id} ${found[0].coded}`);
				});
				temp.permissions = [...new Set(temp.permissions)];
				defaultRolesOrg.push(temp);
			});
			initRolesAdmin = await roles.bulkWrite(authGroup.id, defaultRolesAdmin);
			initRolesOrg = await roles.bulkWrite(authGroup.id, defaultRolesOrg);
			const adminRole = initRolesAdmin.filter((r) => {
				return r.name === 'Admin';
			});
			const accessBody = {
				domains: [initDomain.id],
				roles: [adminRole[0].id]
			};
			initUserAccess = await access.defineAccess(authGroup, initOrg, creator.id, accessBody, undefined, creator.id);
			return {
				products: [ initProductAdmin, initProductOrg ],
				organization: initOrg,
				domain: initDomain,
				roles: [ { groupAdmin: initRolesAdmin, orgAdmin: initRolesOrg }],
				userAccess: initUserAccess
			};
		} catch (error) {
			//roll back
			console.info(error);
			if(initUserAccess && initOrg) {
				console.info('delete user');
				await access.removeOrgFromAccess(authGroup, initOrg, initUserAccess.id);
			}
			if(initDomain) {
				console.info('delete domain');
				await domain.deleteDomain(authGroup.id, initDomain.id);
			}
			if(initOrg) {
				console.info('delete org');
				await orgs.deleteOrg(authGroup.id, initOrg.id);
			}
			if(initRolesAdmin) {
				console.info('delete roles - group');
				await roles.deleteRolesOfProduct(authGroup.id, initProductAdmin.id);
			}
			if(initRolesAdmin) {
				console.info('delete roles - org');
				await roles.deleteRolesOfProduct(authGroup.id, initProductOrg.id);
			}
			if(initProductAdmin) {
				console.info('delete product and permissions');
				await product.deleteProduct(authGroup.id, initProductAdmin.id);
				await perm.deletePermissionsByProduct(authGroup.id, initProductAdmin.id);
			}
			if(initProductOrg) {
				console.info('delete product and permissions');
				await product.deleteProduct(authGroup.id, initProductOrg.id);
				await perm.deletePermissionsByProduct(authGroup.id, initProductOrg.id);
			}
			throw new Error('Could not initialize authGroup access objects. Rolled back.');
		}
	}
};
