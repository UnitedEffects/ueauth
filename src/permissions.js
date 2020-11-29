import Boom from '@hapi/boom';
const config = require('./config');
export default {
	permissionEnforce (roles) {
		const ERROR_MESSAGE = 'You do not have the right permissions';
		return (req, res, next) => {
			try {
				// super admin has full access if "FULL_SUPER_CONTROL" is set to true, otherwise update and delete are disabled
				if(req.permissions && req.permissions.roles && req.permissions.roles.super === true) {
					if(config.FULL_SUPER_CONTROL === true) return next();
					if(superAccess(req)) return next();
					throw Boom.unauthorized('Super Admin is not fully enabled');
				}
				// if we are here, we aren't a super admin, and only they can do cross group queries
				if(req.permissions.sub_group !== req.permissions.req_group) {
					throw Boom.forbidden(ERROR_MESSAGE);
				}
				// must define permissions with this function
				if(!roles) {
					throw Boom.forbidden(ERROR_MESSAGE);
				}
				let access = [];
				if(typeof roles !== 'object') {
					access.push(roles);
				}else{
					access = roles;
				}
				// auth group owner has full access to their group
				if(req.permissions && req.permissions.roles && req.permissions.roles.owner === true) {
					if(access.includes('o')) return next();
				}
				if(req.permissions && req.permissions.roles && req.permissions.roles.member === true) {
					if(access.includes('m')) return next();
				}
				// todo - these are just the hard coded roles, a more expressive system is possible with plugin
				throw Boom.forbidden(ERROR_MESSAGE);
			} catch (error) {
				next(error);
			}
		};
	}
};

function superAccess (req) {
	return !(req.method !== 'get' && req.method !== 'post');
}

// todo - can use this later
function accessByMethod(method, ac) {
	switch (method) {
	case 'get':
		return ac.includes('r');
	case 'post':
		return ac.includes('c');
	case 'patch':
		return ac.includes('u');
	case 'put':
		return ac.includes('u');
	case 'delete':
		return ac.includes('d');
	default:
		return false;
	}
}