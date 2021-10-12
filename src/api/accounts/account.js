import jsonPatch from 'jsonpatch';
import dal from './dal';
import helper from '../../helper';
import iat from '../oidc/initialAccess/iat';
import n from '../plugins/notifications/notifications';
import Boom from '@hapi/boom';
import ueEvents from '../../events/ueEvents';

const config = require('../../config');

export default {
	async writeAccount(data) {
		data.email = data.email.toLowerCase();
		if(!data.username) data.username = data.email;
		const output = await dal.writeAccount(data);
		ueEvents.emit(data.authGroup, 'ue.account.create', output);
		return output;
	},

	// @notTested - filters not tested, general query is
	async getAccounts(authGroupId, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getAccounts(authGroupId, query);
	},

	async getAccount(authGroupId, id) {
		return dal.getAccount(authGroupId, id);
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

	async patchAccount(authGroup, id, update, modifiedBy, bpwd = false) {
		const account = await dal.getAccount(authGroup.id || authGroup._id, id);
		const patched = jsonPatch.apply_patch(account.toObject(), update);
		patched.modifiedBy = modifiedBy;
		if(patched.active === false) {
			if (authGroup.owner === id) throw Boom.badRequest('You can not deactivate the owner of the auth group');
		}
		const originalOrgs = [...new Set(account.organizations)];
		const updatedOrgs = [...new Set(patched.organizations)];
		const domains = [...new Set(patched.orgDomains)];
		if(updatedOrgs.length < originalOrgs.length) {
			const newDomains = [];
			for(let i=0; i<updatedOrgs.length; i++) {
				for(let x=0; x<domains.length; x++) {
					if (domains[x].includes(updatedOrgs[i])) {
						newDomains.push(domains[x]);
					}
				}
			}
			patched.orgDomains = newDomains;
		}
		const result = await dal.patchAccount(authGroup.id || authGroup._id, id, patched, bpwd);
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.account.edit', result);
		return result;
	},

	async updatePassword(authGroupId, id, password, modifiedBy) {
		const update = {
			modifiedBy,
			password
		};
		const output = await dal.updatePassword(authGroupId, id, update);
		ueEvents.emit(authGroupId, 'ue.account.edit', output);
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

	// @notTested
	async resetOrVerify(authGroup, globalSettings, user, formats = [], activeUser = undefined, reset=true) {
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
				data = this.resetPasswordOptions(authGroup, user, iAccessToken, formats, activeUser);
			} else data = this.verifyAccountOptions(authGroup, user, iAccessToken, formats = [], activeUser);

			return n.notify(globalSettings, data, authGroup);
		} catch (error) {
			if(iAccessToken) {
				await iat.deleteOne(iAccessToken.jti, authGroup.id);
			}
			throw error;
		}
	},

	// @notTested
	verifyAccountOptions(authGroup, user, iAccessToken, formats = [], activeUser = undefined) {
		const data = {
			iss: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}`,
			createdBy: activeUser || user.id,
			type: 'verify',
			formats,
			recipientUserId: user.id,
			recipientEmail: user.email,
			recipientSms: user.txt,
			screenUrl: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}/verifyaccount?code=${iAccessToken.jti}`,
			subject: `${authGroup.name} - Verify and Claim Your New Account`,
			message: `You have been added to the authentication group '${authGroup.name}'. Please click the button below or copy past the link in a browser to verify your identity and set your password.`,
			meta: {
				description: 'Direct API Patch Call',
				token: iAccessToken.jti,
				apiHeader: `bearer ${iAccessToken.jti}`,
				apiUri: `${config.PROTOCOL}://${config.SWAGGER}/api/${authGroup.id}/user/${user.id}`,
				apiMethod: 'PATCH',
				apiBody: [
					{
						"op": "replace",
						"path": "/password",
						"value": 'NEW-PASSWORD-HERE'
					},
					{
						"op": "replace",
						"path": "/verified",
						"value": true
					}
				]
			}
		}

		if(formats.length === 0) {
			data.formats = [];
			if(user.email) data.formats.push('email');
			if(user.sms) data.formats.push('sms');
		}
		return data;
	},

	// @notTested
	resetPasswordOptions(authGroup, user, iAccessToken, formats = [], activeUser = undefined) {
		const data = {
			iss: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}`,
			createdBy: activeUser || `proxy_${user.id}`,
			type: 'forgotPassword',
			formats,
			recipientUserId: user.id,
			recipientEmail: user.email,
			recipientSms: user.txt,
			screenUrl: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}/forgotpassword?code=${iAccessToken.jti}`,
			subject: `${authGroup.name} - User Password Reset`,
			message: 'You have requested a password reset. Click the button below or copy past the link in a browser to continue.',
			meta: {
				description: 'Direct API Patch Call',
				token: iAccessToken.jti,
				apiHeader: `bearer ${iAccessToken.jti}`,
				apiUri: `${config.PROTOCOL}://${config.SWAGGER}/api/${authGroup.id}/user/${user.id}`,
				apiMethod: 'PATCH',
				apiBody: [
					{
						"op": "replace",
						"path": "/password",
						"value": 'NEW-PASSWORD-HERE'
					},
					{
						"op": "replace",
						"path": "/verified",
						"value": true
					}
				]
			}
		}
		if(formats.length === 0) {
			data.formats = [];
			if(user.email) data.formats.push('email');
			if(user.sms) data.formats.push('sms');
		}
		return data;
	},
	async searchAccounts(authGroup, q) {
		return dal.searchAccounts(authGroup, q);
	}
};