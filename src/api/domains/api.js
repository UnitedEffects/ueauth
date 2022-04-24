import Boom from '@hapi/boom';
import { say } from '../../say';
import dom from './domain';
import permissions from '../../permissions';
import ueEvents from '../../events/ueEvents';

const RESOURCE = 'Domain';

const api = {
	async writeDomain(req, res, next) {
		try {
			if (!req.authGroup) throw Boom.badRequest('AuthGroup not defined');
			if (!req.organization) throw Boom.badRequest('Organization not defined');
			if (req.authGroup.active === false) throw Boom.forbidden('You can not add orgs to an inactive group');
			if (req.organization.active === false)  throw Boom.forbidden('You can not add domains to an inactive org');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			if (req.user && req.user.sub) {
				req.body.createdBy = req.user.sub;
				req.body.modifiedBy = req.user.sub;
			}
			req.body.authGroup = req.authGroup.id;
			req.body.organization = req.organization.id;
			const result = await dom.writeDomain(req.body);
			return res.respond(say.created(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.domain.error', error);
			next(error);
		}
	},
	async getDomains(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.org) throw Boom.preconditionRequired('Must provide organization');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			if(req.permissions.permissions.includes('domains-limited::read:own')){
				throw Boom.forbidden();
			}
			const result = await dom.getDomains(req.authGroup.id || req.authGroup._id, req.params.org, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getDomain(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.org) return next(Boom.preconditionRequired('Must provide organization'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			if(req.permissions.permissions.includes('domains-limited::read:own')){
				await permissions.enforceOwnDomain(req.permissions, req.params.org, req.params.id);
			}
			const result = await dom.getDomain(req.authGroup.id || req.authGroup._id, req.params.org, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async patchDomain(req, res, next) {
		try {
			if(!req.params.group) return next(Boom.preconditionRequired('Must provide authGroup'));
			if(!req.params.org) return next(Boom.preconditionRequired('Must provide organization'));
			if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			if(req.permissions.permissions.includes('domains-limited::update:own')){
				await permissions.enforceOwnDomain(req.permissions, req.params.org, req.params.id);
			}
			const domain = await dom.getDomain(req.authGroup.id || req.authGroup._id, req.params.org, req.params.id);
			const result = await dom.patchDomain(req.authGroup, domain, req.params.org, req.params.id, req.body, req.user.sub || req.user.id || 'SYSTEM', req.permissions?.core);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.domain.error', error);
			next(error);
		}
	},
	async deleteDomain(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.org) throw Boom.preconditionRequired('Must provide organization');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			if(req.permissions.permissions.includes('domains-limited::delete:own')){
				await permissions.enforceOwnDomain(req.permissions, req.params.org, req.params.id);
			}
			const domain = await dom.getDomain(req.authGroup.id || req.authGroup._id, req.params.org, req.params.id);
			if(domain.core === true) await permissions.enforceRoot(req.permissions);
			const result = await dom.deleteDomain(req.authGroup.id || req.authGroup._id, req.params.org, req.params.id);
			if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.domain.error', error);
			next(error);
		}
	},
};

export default api;