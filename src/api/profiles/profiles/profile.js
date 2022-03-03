import dal from '../dal';
import Boom from '@hapi/boom';
import account from '../../accounts/account';
import ueEvents from '../../../events/ueEvents';
import helper from '../../../helper';
import jsonPatch from 'jsonpatch';
import Joi from 'joi';

const config = require('../../../config');

/**
 *
 'ue.secured.profile.create', (done)
 'ue.secured.profile.edit', (done)
 'ue.secured.profile.destroy', (done)
 'ue.secured.profile.error',
 'ue.secured.profile.organization.synced',
 'ue.secured.profile.copy.created',
 'ue.secured.profile.access.denied',
 'ue.secured.profile.access.approved',
 'ue.secured.profile.access.created',
 *
 */

export default {
	async writeProfile(data) {
		const result = await dal.writeProfile(data);
		ueEvents.emit(data.authGroup, 'ue.secured.profile.create', result);
		return result;
	},
	async getProfiles(authGroup, q) {
		const query = await helper.parseOdataQuery(q);
		return dal.getProfiles(authGroup, query);
	},
	async getProfile(authGroup, id) {
		return dal.getProfile(authGroup, id);
	},
	async deleteProfile(authGroup, id) {
		const result = await dal.deleteProfile(authGroup, id);
		ueEvents.emit(authGroup, 'ue.secured.profile.destroy', result);
		return result;
	},
	async patchProfile(authGroup, profile, id, update, modifiedBy) {
		const patched = jsonPatch.apply_patch(profile.toObject(), update);
		patched.modifiedBy = modifiedBy;
		await standardPatchValidation(profile, patched);
		const result = await dal.patchProfile(authGroup, id, patched);
		ueEvents.emit(authGroup, 'ue.secured.profile.edit', result);
		return result;
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
		accountId: Joi.string().valid(original.accountId).required(),
	};
	const profileSchema = Joi.object().keys(definition);
	const main = await profileSchema.validateAsync(patched, {
		allowUnknown: true
	});
	if(main.error) throw main.error;
}