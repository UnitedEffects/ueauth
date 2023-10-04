import jsonPatch from 'jsonpatch';
import assert from 'assert';
import dal from './dal';
import prof from '../profiles/profiles/profile';
import va from '../profiles/profiles/view';
import helper from '../../helper';
import iat from '../oidc/initialAccess/iat';
import n from '../plugins/notifications/notifications';
import Boom from '@hapi/boom';
import ueEvents from '../../events/ueEvents';
import Joi from 'joi';
import plugins from '../plugins/plugins';
import crypto from 'crypto';
const cryptoRandomString = require('crypto-random-string');

const config = require('../../config');

export default {
	async importAccounts(authGroup, global, array, creator) {
		let failed = [];
		let success = [];
		let ok = 0;
		const attempted = array.length;
		const accounts = [];
		array.map((acc) => {
			const data = {
				email: acc.email,
				authGroup: authGroup.id,
				username: acc.username || acc.email,
				password: cryptoRandomString({length: 16, type: 'url-safe'}),
				phone: acc.phone,
				modifiedBy: creator
			};
			if(acc.id) data._id = acc.id;
			accounts.push(data);
		});
		try {
			const result = await dal.writeMany(accounts);
			ok = result?.length || 0;
			success = JSON.parse(JSON.stringify(result));
		} catch (error) {
			ok = error?.insertedDocs?.length || 0;
			failed = error?.writeErrors;
			success = error?.insertedDocs;
		}
		// todo - event based bulk notification system
		return { warning: 'Auto verify does not work with bulk imports. You will need to send password reset notifications or direct your users to the self-service password reset page.', attempted, ok, failed, success };
	},
	async passwordPolicy(ag, policy, password) {
		const p = policy;
		// example of a custom regex if you want to test it out
		// custom = '(?=.{10,})(?=.*?[^\\w\\s])(?=.*?[0-9])(?=.*?[A-Z]).*?[a-z].*'
		if(p.enabled) {
			let policy;
			let custom = false;
			const standard = (pP) => {
				const pVal = `(?=.{${pP.characters},})${(pP.special) ? '(?=.*?[^\\w\\s])' : ''}${(pP.number ? '(?=.*?[0-9])' : '')}${(pP.caps ? '(?=.*?[A-Z])' : '' )}.*?[a-z].*`;
				return new RegExp(pVal);
			};

			try {
				if(p.pattern.custom) {
					try {
						policy = new RegExp(p.pattern.custom);
						custom = true;
					} catch(e) {
						const message = `Custom Password Policy did not compile - ${p.pattern.custom}. Defaulted to standard.`;
						if(ag) ueEvents.emit(ag, 'ue.account.error', message);
						else console.error(message);
					}
				}
				if(!policy) {
					policy = standard(p.pattern);
				}
			} catch (error) {
				const message = `Unexpected error with password policy validation - ${error.message}`;
				if(ag) ueEvents.emit(ag, 'ue.account.error', message);
				else console.error(message);
				throw Boom.expectationFailed('Password validation is enabled but there was an unexpected error. Contact the admin and try again later.');
			}

			if(!policy.test(password)) {
				const message = (custom) ? 'Password must follow the policy. Contact your administrator' :
					`Password must follow the policy: At least ${p.pattern.characters} characters${(p.pattern.caps) ? ', at least one capital' : ''}${(p.pattern.number) ? ', at least one number' : ''}${(p.pattern.special) ? ', at least one special character' : ''}.`;
				throw Boom.badRequest(message);
			}
		}
	},
	async writeAccount(data, policyPattern, creator = undefined) {
		data.email = data.email.toLowerCase();
		if(!data.username) data.username = data.email;
		if(data.password) {
			await this.passwordPolicy(data.authGroup, policyPattern, data.password);
		}
		const output = await dal.writeAccount(data);
		ueEvents.emit(data.authGroup, 'ue.account.create', output);
		if(data.profile) {
			try {
				await prof.writeProfile({
					accountId: output.id,
					authGroup: output.authGroup,
					...data.profile
				});
				if(creator) {
					const accessObject = {
						authGroup: output.authGroup,
						viewingAccountId: creator.sub,
						viewingEmail: creator.email,
						accessDetails: 'Administrator or service that created this account has unlimited access to your profile. You may remove this access at any time if you wish.',
						targetAccountId: output.id
					};
					await va.createView(accessObject);
				}
			} catch (error) {
				console.error(error);
				if(config.ENV !== 'production') throw error;
			}
		}
		return output;
	},

	// @notTested - filters not tested, general query is
	async getAccounts(authGroupId, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getAccounts(authGroupId, query);
	},

	async getAccount(authGroupId, id, self = false) {
		const acc = await dal.getAccount(authGroupId, id);
		if(!self) return acc;
		return {
			...JSON.parse(JSON.stringify(acc)),
			phone: acc.phone
		};
	},

	async getFederatedAccount(authGroupId, provider, federatedId) {
		return dal.getFederatedAccount(authGroupId, provider, federatedId);
	},

	// @notTested
	async getAccountByOrg(authGroupId, organization, id) {
		return dal.getAccountByOrg(authGroupId, organization, id);
	},

	// @notTested
	async getAccountsByOrg(authGroupId, organization, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getAccountsByOrg(authGroupId, organization, query);
	},

	// @notTested
	async deleteAccount(authGroupId, id) {
		const result = await dal.deleteAccount(authGroupId, id);
		ueEvents.emit(authGroupId, 'ue.account.destroy', result);
		return result;
	},

	async patchAccount(authGroup, id, update, modifiedBy, bpwd = false, limit = false) {
		let password = bpwd;
		const account = await dal.getAccount(authGroup.id || authGroup._id, id);
		const patched = jsonPatch.apply_patch(account.toObject(), update);
		if(patched.password !== account.password) {
			password = true;
			await this.passwordPolicy(authGroup.id, authGroup.config.passwordPolicy, patched.password);
		}
		if(patched.active === false) {
			if (authGroup.owner === id) throw Boom.badRequest('You can not deactivate the owner of the auth group');
		}
		await standardPatchValidation(account, patched, limit);
		const result = await dal.patchAccount(authGroup.id || authGroup._id, id, patched, password);
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.account.edit', result);
		return result;
	},

	async enableMFA(authGroup, id) {
		const account = await dal.enableMFA(authGroup, id);
		return (account?.mfa?.enabled === true);
	},

	async updatePassword(authGroup, id, password, modifiedBy) {
		const update = {
			modifiedBy,
			password
		};
		await this.passwordPolicy(authGroup.id, authGroup.config.passwordPolicy, password);
		const output = await dal.updatePassword(authGroup.id, id, update);
		ueEvents.emit(authGroup.id, 'ue.account.edit', output);
		return output;
	},

	async getAccountByEmailOrUsername(authGroupId, em) {
		const email = String(em).toLowerCase();
		return dal.getAccountByEmailOrUsername(authGroupId, email);
	},

	// @notTested
	async getAccountAccessByEmailOrUsername(authGroupId, em) {
		const email = String(em).toLowerCase();
		return dal.getAccountByEmailOrUsername(authGroupId, email, false, false);
	},

	async passwordResetNotify(authGroup, accountId, global = undefined) {
		let settings;
		if(!global) {
			settings = await plugins.getLatestPluginOptions();
		} else settings = JSON.parse(JSON.stringify(global));
		const user = await this.getAccount(authGroup.id, accountId);
		const aliasDns = authGroup.aliasDnsOIDC || undefined;
		return this.resetOrVerify(authGroup, settings, user, ['email'], undefined, true, aliasDns);
	},

	// @notTested
	// todo - incomplete implementation for bulk user import
	async bulkResetOrVerify(authGroup, globalSettings, users, activeUser = undefined, aliasDns = undefined) {
		const iAccessTokens = await iat.generateManyIAT(900, ['auth_group'], authGroup, users);
		await Promise.all(users.map(async(user) => {
			const findToken = iAccessTokens.filter((t) => {
				return (t.payload.sub === user._id);
			});
			if(findToken.length !== 0) {
				const data = this.verifyAccountOptions(authGroup, user, findToken[0].payload.jti, [], activeUser, aliasDns);
				// todo - you'll still need to create a bulk notification system and only hit DB once for auth + notify objects
				// todo n.notify will not work well for this...
				return n.notify(globalSettings, data, authGroup);
			}
			return user;
		}));
	},
	// @notTested
	async resetOrVerify(authGroup, globalSettings, user, formats = [], activeUser = undefined, reset=true, aliasDns = undefined) {
		let iAccessToken;
		try {
			const meta = {
				auth_group: authGroup.id,
				sub: user.id,
				email: user.email
			};
			iAccessToken = await iat.generateIAT(900, ['auth_group'], authGroup, meta);
			let data;
			if(reset === true){
				data = this.resetPasswordOptions(authGroup, user, iAccessToken, formats, activeUser, aliasDns);
			} else data = this.verifyAccountOptions(authGroup, user, iAccessToken, formats, activeUser, aliasDns);

			return n.notify(globalSettings, data, authGroup);
		} catch (error) {
			if(iAccessToken) {
				await iat.deleteOne(iAccessToken.jti, authGroup.id);
			}
			throw error;
		}
	},

	// @notTested
	verifyAccountOptions(authGroup, user, iAccessToken, formats = [], activeUser = undefined, aliasDns = undefined) {
		const data = {
			iss: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/${authGroup.id}`,
			createdBy: activeUser || user.id,
			type: 'verify',
			formats,
			recipientUserId: user.id,
			recipientEmail: user.email,
			recipientSms: (user.phone && user.phone.txt) ? user.phone.txt : undefined,
			screenUrl: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/${authGroup.id}/verifyaccount?code=${iAccessToken.jti}&user=${user.id}`,
			subject: `${authGroup.name} - Verify and Claim Your New Account`,
			message: `You have been added to the authentication group '${authGroup.name}'. Please click the button below or copy past the link in a browser to verify your identity and set your password.`,
			meta: {
				description: 'Direct API Patch Call',
				token: iAccessToken.jti,
				apiHeader: `bearer ${iAccessToken.jti}`,
				apiUri: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/api/${authGroup.id}/user/${user.id}`,
				apiMethod: 'PATCH',
				apiBody: [
					{
						'op': 'replace',
						'path': '/password',
						'value': 'NEW-PASSWORD-HERE'
					},
					{
						'op': 'replace',
						'path': '/verified',
						'value': true
					}
				]
			}
		};

		if(formats.length === 0) {
			data.formats = [];
			if(user.email) data.formats.push('email');
			if(user.phone && user.phone.txt) data.formats.push('sms');
		}
		return data;
	},

	// @notTested
	resetPasswordOptions(authGroup, user, iAccessToken, formats = [], activeUser = undefined, aliasDns = undefined) {
		const data = {
			iss: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/${authGroup.id}`,
			createdBy: activeUser || `proxy_${user.id}`,
			type: 'forgotPassword',
			formats,
			recipientUserId: user.id,
			recipientEmail: user.email,
			recipientSms: (user.phone && user.phone.txt) ? user.phone.txt : undefined,
			screenUrl: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/${authGroup.id}/forgotpassword?code=${iAccessToken.jti}`,
			subject: `${authGroup.name} - User Password Reset`,
			message: 'You, or an admin, have requested a password reset. To proceed, click the button below or copy paste the link in a browser to continue.',
			meta: {
				description: 'Direct API Patch Call',
				token: iAccessToken.jti,
				apiHeader: `bearer ${iAccessToken.jti}`,
				apiUri: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/api/${authGroup.id}/user/${user.id}`,
				apiMethod: 'PATCH',
				apiBody: [
					{
						op: 'replace',
						path: '/password',
						value: 'NEW-PASSWORD-HERE'
					},
					{
						op: 'replace',
						path: '/verified',
						value: true
					}
				]
			}
		};
		if(formats.length === 0) {
			data.formats = [];
			if(user.email) data.formats.push('email');
			if(user.phone && user.phone.txt) data.formats.push('sms');
		}
		return data;
	},
	async searchAccounts(authGroup, q) {
		return dal.searchAccounts(authGroup, q);
	},
	async generateRecoveryCodes(authGroup, id) {
		const codes = [];
		for(let i=0; i<10; i++) {
			codes.push(cryptoRandomString({length: 10, type: 'url-safe'}));
		}
		const account = await dal.setRecoveryCodes(authGroup, id, codes);
		if(!account) throw Boom.notFound(`Account ${id}`);
		ueEvents.emit(authGroup, 'ue.account.edit', account);
		return { account, codes };
	},
	async userSelfLock (authGroup, id, user) {
		return dal.userLockAccount(authGroup, id, user);
	},
	async initiateRecovery(authGroup, email, codes, state) {
		const account = await dal.getAccountByEmailOrUsername(authGroup.id, email);
		if(!account) throw Boom.notFound();
		if(account.userLocked !== true) throw Boom.forbidden();
		let validCount = 0;
		await Promise.all(codes.map(async (c) => {
			if(await account.verifyRecoverCode(c)) {
				validCount++;
			}
			return c;
		}));
		if(validCount < 7) throw Boom.forbidden('Codes did not match');
		const meta = {
			auth_group: authGroup.id,
			sub: account.id,
			email,
			uid: state
		};
		const iToken = await iat.generateIAT(600, ['auth_group'] , authGroup, meta);
		return { account, token: iToken.jti };
	},
	async unlockAccount(authGroup, id, email, password) {
		return dal.unlockAccount(authGroup, id, email, password);
	},
	async sendAccountLockNotification(authGroup, account, globalSettings) {
		let user;
		if(typeof account === 'string') {
			user = await dal.getAccount(authGroup.id, account);
		} else user = account;
		if(!user.id) throw Boom.notFound();
		const aliasDns = authGroup.aliasDnsOIDC;
		const uid = crypto.randomBytes(10).toString('hex');
		const meta = {
			sub: user.id,
			email: user.email,
			auth_group: authGroup.id,
			uid
		};
		const token = await iat.generateIAT(7200, ['auth_group'], authGroup, meta);
		const data = {
			iss: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/${authGroup.id}`,
			createdBy: user.id,
			type: 'general',
			recipientUserId: user.id,
			recipientEmail: user.email,
			recipientSms: (user.phone && user.phone.txt) ? user.phone.txt : undefined,
			screenUrl: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/${authGroup.id}/interaction/${uid}/lockaccount?code=${token.jti}`,
			subject: `Unusual Account Activity Detected - ${authGroup.name}`,
			message: `Someone is trying to reset a password, reset your recovery codes, or reset your MFA/Device Login configuration. If it was you, please ignore this notice. If this was not you, do not panic, here are your options. First, change your passwords, both with ${authGroup.name} and your email provider. If you do not have MFA enabled, we strongly suggest you do so immediately. If your passwords are secure but your device is missing, you can click [Set Device] from any login page to bind to a new device. If you believe your email account, passwords, and even your device has been compromised, you can perform an emergency lock of your account by clicking the button below. This action will lock your account and disable all logins. It will also disable MFA/Device logins and revoke any devices you have configured. You will then need to take steps to secure your passwords and device, and when ready, use your 10 recovery codes to re-enable your account. If you have not already configured recovery codes you will need to work with the system administrator to re-enable your account. If after consideration you feel there is a security breach, do not hesitate to click below. The button will be active for 2 hours.`
		};
		data.formats = [];
		if(user.email) data.formats.push('email');
		if(user.phone && user.phone.txt) data.formats.push('sms');
		return n.notify(globalSettings, data, authGroup);
	},
	async getActiveAccountCount(authGroup) {
		return dal.getActiveAccountCount(authGroup);
	},
	async getActiveB2BCount(authGroup) {
		return dal.getActiveB2BCount(authGroup);
	},
	async getAccountByEmailUsernameOrPhone(authGroup, data) {
		return dal.getAccountByEmailUsernameOrPhone(authGroup, data);
	},
	async getAccountByEmailOrId(authGroup, data) {
		return dal.getAccountByEmailOrId(authGroup, data);
	},
	async getOwnerGroups(lookup) {
		const result = await dal.getOwnerGroups(lookup);
		const output = result.filter((ag) => {
			return (ag._id === ag.group?.owner);
		});
		return output;
	},
	async notifyOwnerGroups(globalSettings, lookup, authGroup) {
		const uid = crypto.randomBytes(10).toString('hex');
		const meta = {
			email: lookup,
			auth_group: authGroup.id,
			uid
		};
		const token = await iat.generateIAT(7200, ['auth_group'], authGroup, meta);
		const data = {
			iss: `${config.PROTOCOL}://${config.SWAGGER}`,
			createdBy: 'SYSTEM',
			type: 'general',
			recipientEmail: lookup,
			formats: ['email'],
			screenUrl: `${config.PROTOCOL}://${config.SWAGGER}/account/groups/recovery?code=${token.jti}&email=${lookup}&uid=${uid}`,
			subject: 'Company Portal Recovery',
			message: 'Someone has requested a list of Company portals to which you are the owner. If you did not make this request, you may ignore the message. Click the button below to see a list of all Company logins you own. The button will be active for 2 hours.'
		};
		return n.notify(globalSettings, data, authGroup);
	}
};

async function standardPatchValidation(original, patched, limit) {
	const definition = {
		createdAt: Joi.any().valid(original.createdAt).required(),
		modifiedAt: Joi.any().required(),
		modifiedBy: Joi.string().required(),
		authGroup: Joi.string().valid(original.authGroup).required(),
		_id: Joi.string().valid(original._id).required()
	};
	if(limit === true) {
		definition.verified = Joi.string().valid(original.verified).required();
	}
	// ensure access cannot be updated via Patch
	if(original.access?.length !== 0) {
		try {
			assert.deepEqual(JSON.parse(JSON.stringify(patched.access)), JSON.parse(JSON.stringify(original.access)));
		} catch(error) {
			console.error(error);
			throw Boom.forbidden('You can not set access through this API');
		}
	}
	if(!original.access?.length && patched.access?.length !== 0) {
		throw Boom.forbidden('You can not set access through this API');
	}

	// ensure recoverCodes cannot be updated via Patch
	if(original.recoverCodes?.length !== 0) {
		try {
			assert.deepEqual(JSON.parse(JSON.stringify(patched.recoverCodes)), JSON.parse(JSON.stringify(original.recoverCodes)));
		} catch(error) {
			console.error(error);
			throw Boom.forbidden('You can not set recovery codes through this API');
		}
	}
	if(!original.recoverCodes?.length && patched.recoverCodes?.length !== 0) {
		throw Boom.forbidden('You can not set recovery codes through this API');
	}
	const accSchema = Joi.object().keys(definition);
	const main = await accSchema.validateAsync(patched, {
		allowUnknown: true
	});
	if(main.error) throw main.error;
}