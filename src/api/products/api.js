import Boom from '@hapi/boom';
import { say } from '../../say';
import prod from './product';
import perms from '../permissions/permissions';
import permissions from '../../permissions';
import ueEvents from '../../events/ueEvents';
import roles from '../roles/roles';
const coreProductInfo = require('../../../init/currentCore.json');
const coreAdminPermissions = require('../../../init/groupAdminPermissions.json');
const coreOrgPermissions = require('../../../init/orgProductPermissions.json');
const coreRoles = require('../../../init/roles.json');
const config = require('../../config');
const RESOURCE = 'Product';

const api = {
	async getCoreProductMetaData(req, res, next) {
		try {
			if (!req.authGroup) throw Boom.badRequest('AuthGroup not defined');
			const result = await prod.getCoreProducts(req.authGroup);
			if(!result.length) throw Boom.badRequest('No Core Product Detected. Contact the Admin');
			const output = {
				id: req.authGroup.id,
				prettyName: req.authGroup.prettyName,
				coreProducts: result,
				availableVersion: coreProductInfo,
				force: false,
				updateRequired: false
			};
			result.map((r) => {
				const prodCheck = JSON.parse(JSON.stringify(r));
				if(!prodCheck.meta && !prodCheck.meta.permissionsVersion && !prodCheck.meta.rolesVersion) {
					output.updateRequired = true;
					output.force = true;
				} else {
					if(prodCheck.meta.permissionsVersion !== coreProductInfo.permissionsVersion) {
						output.updateRequired = true;
					}
					if(prodCheck.meta.rolesVersion !== coreProductInfo.rolesVersion) {
						output.updateRequired = true;
					}
				}
			});
			if(output.updateRequired === true && coreProductInfo.force === true) {
				output.force = true;
			}
			return res.respond(say.ok(output, RESOURCE));
		} catch(error) {
			next(error);
		}
	},
	async updateCoreProduct(req, res, next) {
		try {
			if (!req.authGroup) throw Boom.badRequest('AuthGroup not defined');
			const results = await prod.getCoreProducts(req.authGroup);
			if(!results.length) throw Boom.badRequest('No Core Product Detected. Contact the Admin');
			let output = {};
			const main = results.map(async (result) => {
				let EXISTING = JSON.parse(JSON.stringify(await perms.getPermissions(req.authGroup.id, result.id, {})));
				const bulkWritePermissions = [];
				const bulkDeletePermissions = [];
				const corePermissions = (result.meta && result.meta.core && result.meta.core === 'groupAdmin')
					? coreAdminPermissions : coreOrgPermissions;
				corePermissions.map((p) => {
					const updatedCode = (p.ownershipRequired===true) ? `${p.target}::${p.action}:own` : `${p.target}::${p.action}`;
					const checkExisting = EXISTING.filter((p) => {
						return p.coded === updatedCode.toLowerCase().replace(/ /g, '-');
					});
					if(!checkExisting.length) {
						if(!p.DEPRECATED) {
							p.description = `${config.PLATFORM_NAME} permission. System Created. DO NOT DELETE`;
							p.product = result.id;
							p.authGroup = req.authGroup.id;
							bulkWritePermissions.push(p);
						}
					} else {
						if(p.DEPRECATED) {
							const destroyId = checkExisting[0]._id || checkExisting[0].id;
							bulkDeletePermissions.push(destroyId);
							EXISTING = EXISTING.filter((p) => {
								return (p !== destroyId);
							});
						}
					}
				});
				const updated = await perms.bulkWrite(req.authGroup.id, bulkWritePermissions);
				EXISTING = EXISTING.concat(updated);
				output[`${result.name}`] = {
					id: result.id || result._id,
					added: bulkWritePermissions,
					removed: bulkDeletePermissions,
					roles: []
				};
				const prodRoles = (result.meta && result.meta.core && result.meta.core === 'groupAdmin')
					? coreRoles.groupAdminPortal : coreRoles.orgAdminPortal;
				const roleTask = prodRoles.map(async (rl) => {
					const query = {};
					query.name = rl.role;
					query.authGroup = req.authGroup.id;
					query.product = result.id;
					query.productCodedId = result.codedId;
					query.core = true;
					let newpermissions = [];
					rl.permissions.map((p) => {
						const found = EXISTING.filter((list) => {
							return list.coded === p.toLowerCase();
						});
						if(found && found.length !== 0) {
							newpermissions.push(`${found[0].id} ${found[0].coded}`);
						} else if (config.ENV !== 'production') {
							throw new Error(`A permission is being added to a role that does not exist: ${p}`);
						}
					});
					newpermissions = [...new Set(newpermissions)];
					let updatedRole = await roles.updateCoreRole(req.authGroup.id, query, { permissions: newpermissions });
					if(!updatedRole) {
						const data = {
							...query,
							createdBy: req.user.sub || 'SYSTEM',
							description : (!rl.description)
								? `${req.authGroup.name} Group Admin Portal Role. System Generated. Do Not Delete` : rl.description,
							permissions: newpermissions
						};
						updatedRole = await roles.writeRoleFull(data);
					}
					output[`${result.name}`].roles.push(updatedRole);
					return updatedRole;
				});
				await Promise.all(roleTask);
				const newMeta = JSON.parse(JSON.stringify(coreProductInfo));
				delete newMeta.force;
				newMeta.core = result.meta.core;
				await prod.updateCoreMetaData(req.authGroup.id, result.id, newMeta);
				const permTask = bulkDeletePermissions.map(async (p) => {
					return perms.deletePermission(req.authGroup.id, result.id, p);
				});
				await Promise.all(permTask);
				return result;
			});
			await Promise.all(main);
			return res.respond(say.ok(output, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async writeProduct(req, res, next) {
		try {
			if (!req.authGroup) throw Boom.badRequest('AuthGroup not defined');
			if (req.authGroup.active === false) throw Boom.forbidden('You can not add orgs to an inactive group');
			if (req.permissions.enforceOwn === true) throw Boom.forbidden();
			if (req.user && req.user.sub) {
				req.body.createdBy = req.user.sub;
				req.body.modifiedBy = req.user.sub;
			}
			req.body.authGroup = req.authGroup.id;
			const result = await prod.writeProduct(req.body);
			return res.respond(say.created(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.product.error', error);
			next(error);
		}
	},
	async getProducts(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			const result = await prod.getProducts(req.authGroup.id || req.authGroup._id, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getOrgProducts(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must provide an organization context');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			const result = await prod.getTheseProducts(req.authGroup.id, req.organization.associatedProducts || []);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getOrgProduct(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must provide an organization context');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			if(!req.organization.associatedProducts.includes(req.params.id)) throw Boom.notFound(req.params.id);
			const result = await prod.getThisProduct(req.authGroup.id || req.authGroup._id, req.params.id);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getOrgDomainProducts(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must provide an organization context');
			if(!req.domain) throw Boom.preconditionRequired('Must provide an organization context');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			await permissions.enforceOwnDomain(req.permissions, req.domain.id);
			const result = await prod.getTheseProducts(req.authGroup.id, req.domain.associatedOrgProducts || []);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getOrgDomainProduct(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must provide an organization context');
			if(!req.domain) throw Boom.preconditionRequired('Must provide an organization context');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			await permissions.enforceOwnDomain(req.permissions, req.domain.id);
			if(!req.domain.associatedOrgProducts.includes(req.params.id)) throw Boom.notFound(req.params.id);
			const result = await prod.getThisProduct(req.authGroup.id || req.authGroup._id, req.params.id);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getProduct(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			await permissions.enforceOwnProduct(req.permissions, req.params.id);
			const result = await prod.getProduct(req.authGroup.id || req.authGroup._id, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async patchProduct(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			const product = await prod.getProduct(req.authGroup.id || req.authGroup._id, req.params.id);
			if(product.core === true) await permissions.enforceRoot(req.permissions);
			const result = await prod.patchProduct(req.authGroup, product, req.params.id, req.body, req.user.sub || req.user.id || 'SYSTEM');
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.product.error', error);
			next(error);
		}
	},
	async deleteProduct(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			const product = await prod.getProduct(req.authGroup.id || req.authGroup._id, req.params.id);
			if(product.core === true) await permissions.enforceRoot(req.permissions);
			const permissions = await perms.deletePermissionsByProduct(req.authGroup.id, req.params.id);
			const result = await prod.deleteProduct(req.authGroup.id || req.authGroup._id, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			const output = {
				permissionsDeleted: permissions.deletedCount,
				product: result
			};
			return res.respond(say.ok(output, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.product.error', error);
			next(error);
		}
	},
	async checkForPermissions(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.product) throw Boom.preconditionRequired('You need to specify a product');
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			const result = await perms.checkForProductReference(req.authGroup.id, req.product.id);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getMyProducts(req, res, next) {
		try {
			const org = req.params.org;
			const products = req.user?.decoded?.['x-access-products']?.[org]?.split(' ') || [];
			const pIds = [];
			products?.map((p) => {
				const t = p?.split(',');
				if(t.length !== 0) pIds.push(t[0].trim());
			});
			const result = await prod.getMyProducts(req.authGroup.id, pIds);
			return res.respond(say.ok({ sub: req.user.sub, ...result }, RESOURCE));
		} catch (error) {
			next(error);
		}
	}
};

export default api;