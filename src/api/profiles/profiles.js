import dal from './dal';
import account from '../accounts/account';
import ueEvents from '../../events/ueEvents';
import helper from '../../helper';
import jsonPatch from 'jsonpatch';
import Joi from 'joi';

const config = require('../../config');

export default {
	async writeOrgProfile(data) {
		const result = await dal.writeOrgProfile(data);
		ueEvents.emit(data.authGroup, 'ue.organization.profile.create', result);
		return result;
	},
	async getOrgProfiles(authGroup, organization, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getOrgProfiles(authGroup, organization, query);
	},
	async getOrgProfile(authGroup, organization, id) {
		return dal.getOrgProfile(authGroup, organization, id);
	},
	async deleteOrgProfile(authGroup, organization, id) {
		const result = await dal.deleteOrgProfile(authGroup, organization, id);
		ueEvents.emit(authGroup, 'ue.organization.profile.destroy', result);
		return result;
	},
	async deleteAllOrgProfiles(authGroup, organization) {
		const result = await dal.deleteAllOrgProfiles(authGroup, organization);
		ueEvents.emit(authGroup, 'ue.organization.profile.destroy', result);
		return result;
	},
	async patchOrgProfile(authGroup, organization, profile, id, update, modifiedBy) {
		const patched = jsonPatch.apply_patch(profile.toObject(), update);
		patched.modifiedBy = modifiedBy;
		await standardPatchValidation(profile, patched);
		const result = await dal.patchOrgProfile(authGroup, organization, id, patched);
		ueEvents.emit(authGroup, 'ue.organization.profile.edit', result);
		return result;
	},
	async profileUpdateNotification (authGroup, organizationName, id, activeUser = 'SYSTEM ADMIN', formats = [], profile, aliasDns = undefined, aliasUi = undefined) {
		const user = await account.getAccount(authGroup.id, id);
		const data = {
			iss: `${config.PROTOCOL}://${aliasDns || config.SWAGGER}/${authGroup.id}`,
			createdBy: activeUser,
			type: 'general',
			formats,
			recipientUserId: user.id,
			recipientEmail: user.email,
			recipientSms: (user.phone && user.phone.txt) ? user.phone.txt : undefined,
			screenUrl: `https://${aliasUi || config.UI_URL}/${authGroup.prettyName}`,
			subject: `${organizationName} Profile Update on ${authGroup.name} Platform`,
			message: `The organization, '${organizationName}', within the ${authGroup.name} Platform, wishes to inform you that some of the personal profile data they have on record about you has been updated. If this is unexpected or concerning, you should reach out to ${organizationName} to review the changes.`,
			meta: profile
		};
		if(formats.length === 0) {
			data.formats = [];
			if(user.email) data.formats.push('email');
			if(user.phone && user.phone.txt) data.formats.push('sms');
		}
		return data;
	}
};

async function standardPatchValidation(original, patched) {
	const definition = {
		createdAt: Joi.any().valid(original.createdAt).required(),
		createdBy: Joi.string().valid(original.createdBy).required(),
		modifiedAt: Joi.any().required(),
		modifiedBy: Joi.string().required(),
		authGroup: Joi.string().valid(original.authGroup).required(),
		_id: Joi.string().valid(original._id).required(),
		organization: Joi.string().valid(original.organization).required(),
		accountId: Joi.string().valid(original.accountId).required(),
		deleteRequested: Joi.boolean().valid(original.deleteRequested).required(),
		deleteRequestedDate: Joi.any().valid(original.deleteRequestedDate).required()
	};
	const orgProfileSchema = Joi.object().keys(definition);
	const main = await orgProfileSchema.validateAsync(patched, {
		allowUnknown: true
	});
	if(main.error) throw main.error;
}