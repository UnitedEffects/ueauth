import Boom from '@hapi/boom';
import { say } from '../../say';
import org from './orgs';
import dom from '../domains/domain';
import permissions from '../../permissions';
import ueEvents from '../../events/ueEvents';

const RESOURCE = 'Organization';

const api = {
	async writeOrg(req, res, next) {
		try {
			if(req.authGroup.active === false) throw Boom.forbidden('You can not add orgs to an inactive group');
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			if (req.user && req.user.sub) {
				req.body.createdBy = req.user.sub;
				req.body.modifiedBy = req.user.sub;
			}
			const organization = await org.writeOrg(req.authGroup.id, req.body);
			const adminDomain = {
				name: `${req.authGroup.name} - ${organization.name} - Administrative Domain`,
				description: `Use this domain to enable user and permissions management of ${organization.name}. Do not delete as system access will be compromised.`,
				authGroup: req.authGroup.id,
				organization: organization._id,
				createdBy: req.user.sub,
				associatedOrgProducts: organization.associatedProducts,
				meta: {
					admin: organization._id
				},
				core: true
			};
			const domain = await dom.writeDomain(adminDomain);
			return res.respond(say.created({ organization, domain }, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.organization.error', error);
			next(error);
		}
	},
	async getOrgs(req, res, next) {
		try {
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			const result = await org.getOrgs(req.params.group, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getOrg(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			await permissions.enforceOwnOrg(req.permissions, req.params.id);
			const result = await org.getOrg(req.params.group, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getMyOrgs(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			const orgs = req.permissions.organizations || [];
			const user = req.user.sub;
			const result = await org.getTheseOrgs(req.authGroup.id, orgs);
			return res.respond(say.ok({ sub: user, organizations: result }, RESOURCE));
		} catch(error) {
			next(error);
		}
	},
	async patchOrg(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			await permissions.enforceOwnOrg(req.permissions, req.params.id);
			const organization = await org.getOrg(req.authGroup.id, req.params.id);
			const result = await org.patchOrg(req.authGroup, organization, req.params.id, req.body, req.user.sub || req.user.id || 'SYSTEM', req.permissions.enforceOwn);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.organization.error', error);
			next(error);
		}
	},
	async deleteOrg(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			await permissions.enforceOwnOrg(req.permissions, req.params.id);
			const organization = await org.getOrg(req.authGroup.id, req.params.id);
			if(organization.core === true) await permissions.enforceRoot(req.permissions);
			const result = await org.deleteOrg(req.params.group, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.organization.error', error);
			next(error);
		}
	},
};


export default api;