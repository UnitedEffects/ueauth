import Boom from '@hapi/boom';
import { say } from '../../say';
import prod from './product';
import perms from '../permissions/permissions';
import permissions from '../../permissions';
import ueEvents from '../../events/ueEvents';
import roles from '../roles/roles';
import {nanoid} from "nanoid";
const coreProductInfo = require('../../../init/currentCore.json');
const corePermissions = require('../../../init/permissions.json');
const coreRoles = require('../../../init/roles.json');
const config = require('../../config');
const RESOURCE = 'Product';

const api = {
	async getCoreProductMetaData(req, res, next) {
		try {
			if (!req.authGroup) throw Boom.badRequest('AuthGroup not defined');
			const result = await prod.getCoreProduct(req.authGroup);
			if(!result) throw Boom.badRequest('No Core Product Detected. Contact the Admin');
			const output = {
				id: req.authGroup.id,
				prettyName: req.authGroup.prettyName,
				coreProduct: result.name,
				coreProductId: result.id,
				coreAccessDataVersion: {
					permissions: (result.meta) ? result.meta.permissionsVersion : undefined,
					roles: (result.meta) ? result.meta.rolesVersion : undefined
				},
				availableVersion: coreProductInfo,
				updateRequired: false
			};
			if(!result.meta || !result.meta.permissionsVersion || !result.meta.rolesVersion) output.updateRequired = true;
			else {
				if(result.meta.permissionsVersion !== coreProductInfo.permissionsVersion) output.updateRequired = true;
				if(result.meta.rolesVersion !== coreProductInfo.rolesVersion) output.updateRequired = true;
			}
			return res.respond(say.ok(output, RESOURCE));
		} catch(error) {
			next(error);
		}
	},
	async updateCoreProduct(req, res, next) {
		try {
			if (!req.authGroup) throw Boom.badRequest('AuthGroup not defined');
			const result = await prod.getCoreProduct(req.authGroup);
			if(!result) throw Boom.badRequest('No Core Product Detected. Contact the Admin');
			let EXISTING = JSON.parse(JSON.stringify(await perms.getPermissions(req.authGroup.id, result.id, {})));
			const bulkWritePermissions = [];
			const bulkDeletePermissions = [];
			corePermissions.map((p) => {
				const updatedCode = (p.ownershipRequired===true) ? `${p.target}::${p.action}:own` : `${p.target}::${p.action}`;
				const checkExisting = EXISTING.filter((p) => {
					return p.coded === updatedCode;
				});
				if(!checkExisting.length) {
					p.description = `${config.PLATFORM_NAME} permission. System Created. DO NOT DELETE`;
					p.product = result.id;
					p.authGroup = req.authGroup.id;
					bulkWritePermissions.push(p);
				}
				if(checkExisting.length) {
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
			const output = {
				added: bulkWritePermissions,
				removed: bulkDeletePermissions,
				roles: []
			};
			const roleTask = coreRoles.map(async (rl) => {
				const query = {};
				query.name = rl.role;
				query.authGroup = req.authGroup.id;
				query.product = result.id;
				query.productCodedId = result.codedId;
				query.core = true;
				let newpermissions = [];
				rl.permissions.map((p) => {
					const found = EXISTING.filter((list) => {
						return list.coded === p;
					});
					newpermissions.push(`${found[0].id} ${found[0].coded}`);
				});
				newpermissions = [...new Set(newpermissions)];
				let updatedRole = await roles.updateCoreRole(req.authGroup.id, query, { permissions: newpermissions });
				if(!updatedRole) {
					const data = {
						...query,
						createdBy: req.user.sub || 'SYSTEM',
						description : (!rl.description) ? `${config.PLATFORM_NAME} Role. System Generated. Do Not Delete` : rl.description,
						permissions: newpermissions
					};
					updatedRole = await roles.writeRoleFull(data);
				}
				output.roles.push(updatedRole);
				return updatedRole;
			});
			await Promise.all(roleTask);
			await prod.updateCoreMetaData(req.authGroup.id, result.id, coreProductInfo);
			const permTask = bulkDeletePermissions.map(async (p) => {
				return perms.deletePermission(req.authGroup.id, result.id, p);
			});
			await Promise.all(permTask);
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
			await permissions.enforceOwnProduct(req.permissions, req.params.id);
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
			await permissions.enforceOwnProduct(req.permissions, req.params.id);
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
			const result = await perms.checkForProductReference(req.authGroup.id, req.product.id);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	}
};

export default api;