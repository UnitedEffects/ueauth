import { nanoid } from 'nanoid';
import orgs from './api/orgs/orgs';
import product from './api/products/product';
import domain from './api/domains/domain';
import perm from './api/permissions/permissions';
import roles from './api/roles/roles';
import access from './api/accounts/access';
const config = require('./config');
const permArray = require('../init/permissions.json');
const coreRoles = require('../init/roles.json');
const coreVersion = require('../init/currentCore.json');

export default {
	async createDefaultOrgAndDomain(authGroup, creator) {
		let initOrg;
		let initDomain;
		let initProduct;
		let initRoles;
		let initUserAccess;
		let permissions;
		let bulkPermWrite = [];
		try {
			const defaultProduct = {
				name: `${authGroup.name} - ${config.PLATFORM_NAME}`,
				description: `Internal product reference for group '${authGroup.name}'. Add users to this product to access platform features. Do not delete as system access will be compromised`,
				authGroup: authGroup.id,
				type: 'global',
				createdBy: creator.id,
				meta: coreVersion,
				core: true
			};
			initProduct = await product.writeProduct(defaultProduct);
			if(!initProduct) throw new Error('Could not initialize platform product');
			permArray.map((p) => {
				p.description = `${config.PLATFORM_NAME} permission. System Created. DO NOT DELETE`;
				p.product = initProduct.id;
				p.authGroup = authGroup.id;
				bulkPermWrite.push(p);
			});
			permissions = await perm.bulkWrite(authGroup.id, bulkPermWrite);
			const defaultOrg = {
				name: `${authGroup.name} - Organization`,
				description: `Primary organization of authGroup '${authGroup.name}'. Do not delete as system access will be compromised.`,
				type: 'internal',
				createdBy: creator.id,
				authGroup: authGroup.id,
				contactEmail: creator.email,
				associatedProducts: [initProduct.id],
				core: true
			};
			initOrg = await orgs.writeOrg(authGroup.id, defaultOrg);
			if(!initOrg) throw new Error('Could not initialize primary organization');
			const defaultDom = {
				name: `${authGroup.name} - Primary Domain`,
				description: `Primary domain of organization '${initOrg.name}'. Do not delete as system access will be compromised.`,
				authGroup: authGroup.id,
				organization: initOrg.id,
				createdBy: creator.id,
				associatedOrgProducts: [initProduct.id],
				core: true
			};
			initDomain = await domain.writeDomain(defaultDom);
			if(!initDomain) throw new Error('Could not initialize primary domain');
			const defaultRoles = [];
			coreRoles.map((rl) => {
				const temp = {};
				temp.name = rl.role;
				temp.createdBy = creator.id;
				temp.authGroup = authGroup.id;
				temp.description = (!rl.description) ? `${config.PLATFORM_NAME} Role. System Generated. Do Not Delete` : rl.description;
				temp.product = initProduct.id;
				temp.productCodedId = initProduct.codedId;
				temp.core = true;
				temp.permissions = [];
				temp.codedId = nanoid(10);
				rl.permissions.map((p) => {
					const found = permissions.filter((list) => {
						return list.coded === p;
					});
					temp.permissions.push(`${found[0].id} ${found[0].coded}`);
				});
				temp.permissions = [...new Set(temp.permissions)];
				defaultRoles.push(temp);
			});
			initRoles = await roles.bulkWrite(authGroup.id, defaultRoles);
			const adminRole = initRoles.filter((r) => {
				return r.name === 'Admin';
			});
			const accessBody = {
				domains: [initDomain.id],
				roles: [adminRole[0].id]
			};
			initUserAccess = await access.defineAccess(authGroup.id, initOrg.id, creator.id, accessBody);
			return {
				product: initProduct,
				organization: initOrg,
				domain: initDomain,
				roles: initRoles,
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
			if(initRoles) {
				console.info('delete roles');
				await roles.deleteRolesOfProduct(authGroup.id, initProduct.id);
			}
			if(initProduct) {
				console.info('delete product and permissions');
				await product.deleteProduct(authGroup.id, initProduct.id);
				await perm.deletePermissionsByProduct(authGroup.id, initProduct.id);
			}
			throw new Error('Could not initialize authGroup access objects. Rolled back.');
		}
	}
};