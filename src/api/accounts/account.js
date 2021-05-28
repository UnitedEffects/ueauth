import jsonPatch from 'jsonpatch';
import dal from './dal';
import helper from '../../helper';
import iat from "../oidc/initialAccess/iat";
import n from "../plugins/notifications/notifications";

const config = require('../../config');

export default {
	async writeAccount(data) {
		data.email = data.email.toLowerCase();
		if(!data.username) data.username = data.email;
		return dal.writeAccount(data);
	},

	async getAccounts(authGroupId, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getAccounts(authGroupId, query);
	},

	async getAccount(authGroupId, id) {
		return dal.getAccount(authGroupId, id);
	},

	async deleteAccount(authGroupId, id) {
		return dal.deleteAccount(authGroupId, id);
	},

	async patchAccount(authGroupId, id, update, modifiedBy) {
		const account = await dal.getAccount(authGroupId, id);
		const patched = jsonPatch.apply_patch(account.toObject(), update);
		patched.modifiedBy = modifiedBy;
		return dal.patchAccount(authGroupId, id, patched);
	},

	async updatePassword(authGroupId, id, password, modifiedBy) {
		const update = {
			modifiedBy,
			password
		};
		return dal.updatePassword(authGroupId, id, update);
	},

	async getAccountByEmailOrUsername(authGroupId, em) {
		const email = String(em).toLowerCase();
		return dal.getAccountByEmailOrUsername(authGroupId, email);
	},

	async resetOrVerify(authGroup, globalSettings, user, formats = [], activeUser = undefined, reset=true) {
		let iAccessToken;
		try {
			const meta = {
				auth_group: authGroup.id,
				sub: user.id,
				email: user.email
			};
			iAccessToken = await iat.generateIAT(14400, ['auth_group'], authGroup, meta);
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

	verifyAccountOptions(authGroup, user, iAccessToken, formats = [], activeUser = undefined) {
		const data = {
			iss: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}`,
			createdBy: activeUser || user.id,
			type: 'verify',
			formats,
			recipientUserId: user.id,
			recipientEmail: user.email,
			recipientSms: user.sms,
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

	resetPasswordOptions(authGroup, user, iAccessToken, formats = [], activeUser = undefined) {
		const data = {
			iss: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}`,
			createdBy: activeUser || `proxy_${user.id}`,
			type: 'forgotPassword',
			formats,
			recipientUserId: user.id,
			recipientEmail: user.email,
			recipientSms: user.sms,
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
	}
};