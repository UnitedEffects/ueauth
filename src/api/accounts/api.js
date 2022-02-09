import Boom from '@hapi/boom';
import { say } from '../../say';
import acct from './account';
import access from './access';
import group from '../authGroup/group';
import challenge from '../plugins/challenge/challenge';
import iat from '../oidc/initialAccess/iat';
import cl from '../oidc/client/clients';
import permissions from '../../permissions';
import n from '../plugins/notifications/notifications';
import ueEvents from '../../events/ueEvents';
import initAccess from '../../initUEAuth';
import crypto from "crypto";
const cryptoRandomString = require('crypto-random-string');

const config = require('../../config');

const RESOURCE = 'Account';

const api = {
	async writeAccount(req, res, next) {
		try {
			if (req.groupActivationEvent === true) return api.activateGroupWithAccount(req, res, next);
			if (req.authGroup.active === false) throw Boom.forbidden('You can not add members to an inactive group');
			if (!req.body.email) throw Boom.preconditionRequired('username is required');
			if (req.body.generatePassword === true) {
				req.body.password = cryptoRandomString({length: 32, type: 'url-safe'});
			}
			if (!req.body.password) throw Boom.preconditionRequired('password is required');
			const password = req.body.password;
			delete req.body.generatePassword; //clean up
			if (req.user && req.user.sub) req.body.modifiedBy = req.user.sub;
			const result = await acct.writeAccount(req.body);
			try {
				if (req.globalSettings.notifications.enabled === true &&
                    req.authGroup.pluginOptions.notification.enabled === true &&
                    req.authGroup.config.autoVerify === true) {
					await acct.resetOrVerify(req.authGroup, req.globalSettings, result,[], (req.user) ? req.user.sub : undefined, false, req.customDomain);
				}
			} catch (er) {
				console.error(er);
				throw Boom.failedDependency('You have automatic email verification enabled but something went wrong. The user should trigger a forgot password to verify the account.', {account: result, error: er.stack || er.message});
			}
			const output = JSON.parse(JSON.stringify(result));
			output.password = password;
			return res.respond(say.created(output, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.account.error', error);
			next(error);
		}
	},

	async createOrAssociateAccount(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must provide associated Organization');
			if (req.authGroup.active === false) throw Boom.forbidden('You can not add members to an inactive group');
			if (!req.body.email) throw Boom.preconditionRequired('username is required');
			let allowed = false;
			if (req.organization.emailDomains.length !== 0) {
				req.organization.emailDomains.map((d) => {
					if(req.body.email.includes(d)) allowed = true;
				});
			} else allowed = true;
			if(allowed === false) throw Boom.badRequest('This organization has restricted email domains', req.organization.emailDomains);
			const user = await acct.getAccountAccessByEmailOrUsername(req.authGroup.id, req.body.email);
			let result;
			let newUser;
			let password = cryptoRandomString({length: 32, type: 'url-safe'});
			if(user) {
				const checkForOrg = user.access.filter((ac) => {
					return (ac.organization.id === req.organization.id);
				});
				if(!checkForOrg.length) {
					result = await access.defineAccess(req.authGroup, req.organization, user._id, {}, req.globalSettings, req.user.sub, 'created', true, req.customDomainUI, req.customDomain);
				} else result = user;
			} else {
				try {
					newUser = await acct.writeAccount({
						username: (req.body.username) ? req.body.username : req.body.email,
						email: req.body.email,
						authGroup: req.authGroup.id,
						password
					});
					if(!newUser) throw new Error('Could not create user');
					result = await access.defineAccess(req.authGroup, req.organization, newUser._id, {}, req.globalSettings, req.user.sub, 'created', true, req.customDomainUI, req.customDomain);
				} catch (e) {
					if(newUser && newUser._id) await acct.deleteAccount(req.authGroup.id, newUser._id);
					throw e;
				}
			}
			if(newUser) {
				try {
					if (req.globalSettings && req.globalSettings.notifications.enabled === true &&
						req.authGroup.pluginOptions.notification.enabled === true &&
						req.authGroup.config.autoVerify === true) {
						await acct.resetOrVerify(req.authGroup, req.globalSettings, newUser,[], (req.user) ? req.user.sub : undefined, false, req.customDomain);
					} else {
						result = {
							...JSON.parse(JSON.stringify(result)),
							WARNING: 'User was created but notifications are disabled. We are returning the generated password for you to provide but this is an inherently less secure approach. We strongly recommend you enable notifications.',
							generatedPassword: password
						};
					}
				} catch (er) {
					console.error(er);
					throw Boom.failedDependency('You have automatic email verification enabled but something went wrong. The user should trigger a forgot password to verify the account.', {account: result, error: er.stack || er.message});
				}
			}
			result = {
				...JSON.parse(JSON.stringify(result)),
				access: [ { organization: { id: req.organization.id }}]
			};
			return res.respond(say.created(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.account.error', error);
			next(error);
		}
	},
	async activateGroupWithAccount(req, res, next) {
		let account;
		let client;
		try {
			req.body.verified = true;
			account = await acct.writeAccount(req.body);
			if(!account) throw Boom.expectationFailed('Account not created due to unknown error. Try again later');
			try {
				client = await cl.generateClient(req.authGroup);
			} catch (e) {
				if(e.code === 11000){
					client = await cl.getOneByNameAndAG(req.authGroup, config.PLATFORM_NAME);
				} else throw e;
			}
			if(!client) throw Boom.expectationFailed('Auth Group Client Not Created! Rolling back.');
			let g = await group.activateNewAuthGroup(req.authGroup, account, client.client_id);
			if(!g) throw Boom.expectationFailed('Auth Group Not Activated! Rolling back.');
			const access = await initAccess.createDefaultOrgAndDomain(g, account);
			g = JSON.parse(JSON.stringify(g));
			if(g.config) delete g.config.keys;
			const out = {
				account,
				authGroup: g,
				client,
				access
			};
			try {
				//console.info(req.authInfo);
				const result = await iat.deleteOne(req.authInfo.token._id, req.authGroup._id);
				//console.info(result);
			} catch (error) {
				console.error(error);
				console.error('could not clean token');
			}
			return res.respond(say.created(out, RESOURCE));
		} catch (error) {
			if (account) {
				try {
					const aDone = await acct.deleteAccount(req.authGroup, account._id);
					if(!aDone) throw new Error('Account delete not complete');
				} catch (error) {
					console.error(error);
					console.info('Account Rollback: There was a problem and you may need the admin to finish setup');
				}
			}
			if (client) {
				try {
					const cDone = await client.deleteOne(req.authGroup, client.client_id);
					if(!cDone) throw new Error('Client delete not complete');
				} catch (error) {
					console.error(error);
					console.info('Client Rollback: There was a problem and you may need the admin to finish setup');
				}
			}
			ueEvents.emit(req.authGroup.id, 'ue.account.error', error);
			next(error);
		}
	},
	async getAccounts(req, res, next) {
		try {
			if(req.permissions.enforceOwn === true) throw Boom.forbidden();
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			const result = await acct.getAccounts(req.params.group, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getAccount(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			const id = (req.params.id === 'me') ? req.user.sub : req.params.id;
			await permissions.enforceOwn(req.permissions, id);
			const result = await acct.getAccount(req.params.group, id, (req.user.sub === id));
			if (!result) throw Boom.notFound(`id requested was ${id}`);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getAccountsByOrg(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must provide associated Organization');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			const result = await acct.getAccountsByOrg(req.authGroup.id, req.organization.id, req.query);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async getAccountByOrg(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must provide associated Organization');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			const id = req.params.id;
			if(req.user.sub !== req.params.id) await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			const result = await acct.getAccountByOrg(req.params.group, req.organization.id, id);
			if (!result) throw Boom.notFound(`id requested was ${id}`);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			next(error);
		}
	},
	async patchAccount(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			let bpwd = false;
			if(req.user && req.user.decoded && req.user.decoded.kind === 'InitialAccessToken') {
				if (req.body) {
					if(req.body.length > 1 || req.body[0].path !== '/password' || req.body[0].op !== 'replace') {
						throw Boom.methodNotAllowed();
					}
				}
			}
			await permissions.enforceOwn(req.permissions, req.params.id);
			const result = await acct.patchAccount(req.authGroup, req.params.id, req.body, req.user.sub || req.user.id || 'SYSTEM', bpwd, req.permissions.enforceOwn);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.account.error', error);
			next(error);
		}
	},
	async deleteAccount(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			await permissions.enforceOwn(req.permissions, req.params.id);
			if(req.authGroup.owner === req.params.id) throw Boom.badRequest('You can not delete the owner of the auth group');
			const result = await acct.deleteAccount(req.params.group, req.params.id);
			if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
			return res.respond(say.ok(result, RESOURCE));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.account.error', error);
			next(error);
		}
	},

	async resetPassword(req, res, next) {
		let result;
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.body.email) throw Boom.preconditionRequired('Must provide email address');
			if(req.globalSettings.notifications.enabled === false) throw Boom.methodNotAllowed('There is no Global Notification Plugin enabled. You will need the admin to reset your password directly and inform you of the new password');
			if(req.authGroup.pluginOptions.notification.enabled === false) throw Boom.methodNotAllowed('Your admin has not enabled notifications. You will need the admin to reset your password directly and inform you of the new password');
			const user = await acct.getAccountByEmailOrUsername(req.authGroup.id, req.body.email, req.authGroup.config.requireVerified);
			if(!user) throw Boom.notFound('This email address is not registered with our system');
			// todo send emergency lock notification
			if(user.mfa?.enabled === true) {
				const ag = JSON.parse(JSON.stringify(req.authGroup));
				const uid = crypto.randomBytes(32).toString('hex');
				const meta = {
					event: 'PASSWORD_RESET',
					content: {
						title: 'Password Reset',
						header: `${ag.name} Platform Identity`,
						body: 'Do you want to initiate a password reset? If so, click "Approve" below. Otherwise, click "Decline" or ignore this notification.'
					}
				};
				await challenge.sendChallenge(ag, req.globalSettings, { accountId: user.id, mfaEnabled: true}, uid, meta);
			} else {
				result = await acct.resetOrVerify(req.authGroup, req.globalSettings, user, req.body.formats, undefined, true, req.customDomain);
			}
			return res.respond(say.noContent(RESOURCE));
		} catch (error) {
			if(result) {
				await n.deleteNotification(req.authGroup, result.id);
			}
			if(error.isAxiosError) {
				return next(Boom.failedDependency('There is an error with the global notifications service plugin - contact the admin'));
			}
			ueEvents.emit(req.authGroup.id, 'ue.account.error', error);
			return next(error);
		}
	},
	async userOperationsByOrg(req, res, next) {
		try {
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			if(!req.organization) throw Boom.preconditionRequired('Must specify organizatin');
			if (!req.body.operation) return res.respond(say.noContent('User Operation'));
			const user = await acct.getAccountByOrg(req.authGroup.id, req.organization.id, req.params.id);
			if(req.params.id !== req.user.sub) await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			const password = cryptoRandomString({length: 32, type: 'url-safe'});
			if(req.body.operation === 'generate_password') throw Boom.badRequest('operation not supported at the org level');
			const result = await userOperation(req, user, password);
			return res.respond(result);
		} catch (error) {
			if(error.isAxiosError) {
				return next(Boom.failedDependency('There is an error with the global notifications service plugin - contact the admin'));
			}
			ueEvents.emit(req.authGroup.id, 'ue.account.error', error);
			next(error);
		}

	},
	async userOperations(req, res, next) {
		try {
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			if (!req.body.operation) return res.respond(say.noContent('User Operation'));
			const user = await acct.getAccount(req.authGroup.id, req.params.id);
			await permissions.enforceOwn(req.permissions, user.id);
			const password = cryptoRandomString({length: 32, type: 'url-safe'});
			const result = await userOperation(req, user, password);
			return res.respond(result);
		} catch (error) {
			if(error.isAxiosError) {
				return next(Boom.failedDependency('There is an error with the global notifications service plugin - contact the admin'));
			}
			ueEvents.emit(req.authGroup.id, 'ue.account.error', error);
			next(error);
		}
	},
	async defineAccess(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			if(!req.organization) throw Boom.preconditionRequired('Must provide an organization to apply access to');
			await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			const notify = (!req.query.notify || req.query.notify === true);
			const result = await access.defineAccess(req.authGroup, req.organization, req.params.id, req.body, req.globalSettings, req.user.sub, 'updated', notify, req.customDomainUI, req.customDomain);
			if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
			return res.respond(say.ok(result, 'Access'));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.access.error', error);
			next(error);
		}
	},
	async getDefinedAccess(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			if(!req.organization) throw Boom.preconditionRequired('Must provide an organization to get access from');
			if(req.user.sub !== req.params.id) await permissions.enforceOwnOrg(req.permissions, req.organization.id);
			const result = await access.getDefinedAccess(req.authGroup.id, req.organization.id, req.params.id);
			if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
			return res.respond(say.ok(result, 'Access'));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.access.error', error);
			next(error);
		}
	},
	async removeOrgFromAccess(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.params.id) throw Boom.preconditionRequired('Must provide id');
			if(!req.organization) throw Boom.preconditionRequired('Must provide an organization to remove');
			if(!req.permissions.permissions) throw Boom.preconditionRequired('Permission error');
			let orgLevelPermission = [];
			orgLevelPermission = req.permissions.permissions.filter((p) => {
				return (p.includes('accounts-organization::delete'));
			});
			if(orgLevelPermission.length === 0) await permissions.enforceOwn(req.permissions, req.params.id);
			else {
				// make sure that regardless of actual permission condition, the user belongs to this organization
				const p = JSON.parse(JSON.stringify(req.permissions));
				p.enforceOwn = true;
				await permissions.enforceOwnOrg(p, req.organization.id);
			}
			const result = await access.removeOrgFromAccess(req.authGroup.id, req.organization.id, req.params.id);
			if (!result) throw Boom.notFound(`id requested was ${req.params.id}`);
			return res.respond(say.ok(result, 'Access'));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.access.error', error);
			next(error);
		}
	},
	async getAllOrgs(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must provide authGroup');
			const id = req.user.sub;
			const result = await access.getAllOrgs(req.authGroup.id, id);
			return res.respond(say.ok(result, 'Access'));
		} catch (error) {
			next(error);
		}
	},
	async acceptOrDeclineOrgTerms(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must provide authGroup');
			if(!req.organization) throw Boom.preconditionRequired('Must provide an organization to remove');
			if(!req.body.action) throw Boom.badRequest('You must specify an action: accept or decline');
			const id = req.user.sub;
			const org = await access.checkOneUserOrganizations(req.authGroup, req.organization.id, id);
			if(!org || org.id !== id) {
				throw Boom.badRequest('You have not been added to the organization', { organization: req.organization.id });
			}
			const result = await access.userActionOnOrgTerms(req.authGroup, req.organization.id, id, req.body.action);
			return res.respond(say.ok(result, 'Access'));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.access.error', error);
			next(error);
		}
	},
	async getUserAccess(req, res, next) {
		try {
			if(!req.params.group) throw Boom.preconditionRequired('Must provide authGroup');
			let id;
			if(!req.params.id) {
				if(!req.user || !req.user.sub ) throw Boom.preconditionRequired('Must provide id or valid user token');
				id = req.user.sub;
			} else {
				id = (req.params.id === 'me') ? req.user.sub : req.params.id;
				await permissions.enforceOwn(req.permissions, id);
			}
			const result = await access.getUserAccess(req.authGroup, id, req.query);
			if (!result) throw Boom.notFound(`id requested was ${id}`);
			return res.respond(say.ok(result, 'Access'));
		} catch (error) {
			ueEvents.emit(req.authGroup.id, 'ue.access.error', error);
			next(error);
		}
	},
	async searchAccounts(req, res, next) {
		try {
			if(!req.authGroup) throw Boom.preconditionRequired('Must provide an AuthGroup');
			if(!req.query.q) throw Boom.badRequest('no search provided');
			let domains = [];
			if(req.query.restrictEmail) {
				domains = req.query.restrictEmail.replace(' ', '').split(',');
			}
			const search = req.query.q;
			let like = await acct.searchAccounts(req.authGroup.id, search);
			let exact = await acct.getAccountByEmailOrUsername(req.authGroup.id, search);
			if (exact) {
				exact = {
					id: exact._id,
					email: exact.email,
					username: exact.username
				};
			}
			if(domains.length !== 0) {
				if(exact && exact.email) {
					let valid = false;
					domains.map((d) => {
						if(exact.email.includes(d)) {
							valid = true;
						}
					});
					if (valid === false) exact = {};
				}
				if(like.length !== 0) {
					let filteredLike = [];
					domains.map((d) => {
						like.map((ac) => {
							if(ac.email.includes(d)) {
								filteredLike.push({
									id: ac._id,
									email: ac.email
								});
							}
						});
					});
					like = filteredLike;
				}
			}
			return res.respond(say.ok({ exact, like }, RESOURCE));
		} catch (error) {
			next(error);
		}
	}
};

async function userOperation(req, user, password) {
	let result;
	switch (req.body.operation) {
	case 'verify_account':
		try {
			if (req.globalSettings.notifications.enabled === true &&
					req.authGroup.pluginOptions.notification.enabled === true) {
				result = await acct.resetOrVerify(req.authGroup, req.globalSettings, user,[], req.user.sub, false, req.customDomain);
				return say.noContent(RESOURCE);
			}
			throw Boom.badRequest('Notifications are not enabled and are required for this operation');
		} catch (error) {
			if(result) {
				await n.deleteNotification(req.authGroup, result.id);
			}
			throw error;
		}
	case 'password_reset':
		try {
			if (req.globalSettings.notifications.enabled === true &&
					req.authGroup.pluginOptions.notification.enabled === true) {
				result = await acct.resetOrVerify(req.authGroup, req.globalSettings, user,[], req.user.sub, true, req.customDomain);
				return say.noContent(RESOURCE);
			}
			throw Boom.badRequest('Notifications are not enabled and are required for this operation');
		} catch (error) {
			if(result) {
				await n.deleteNotification(req.authGroup, result.id);
			}
			throw error;
		}
	case 'generate_password':
		result = await acct.updatePassword(req.authGroup.id, req.params.id, password, (req.user) ? req.user.sub : undefined, req.customDomain);
		return say.ok(result, RESOURCE);
	default:
		throw Boom.badRequest('Unknown operation');
	}
}

export default api;