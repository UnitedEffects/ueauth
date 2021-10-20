import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import h from '../../../helper';

mongoose.set('useCreateIndex', true);

const orgProfileSchema = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now()
	},
	createdBy: {
		type: String,
		default: 'SYSTEM_ADMIN'
	},
	modifiedAt: {
		type: Date,
		default: Date.now()
	},
	modifiedBy: {
		type: String,
		default: 'SYSTEM_ADMIN'
	},
	authGroup: {
		type: String,
		required: true
	},
	accountId: {
		type: String,
		validate: {
			validator: function (v) {
				const ag = this.authGroup;
				const org = this.organization;
				return h.validateAccountReference(mongoose.model('accounts'), v, ag, org);
			},
			message: 'Account does not exist in this AuthGroup and/or Organization'
		}
	},
	organization: {
		type: String,
		required: true
	},
	externalId: String,
	givenName: String,
	familyName: String,
	displayName: String,
	bio: String,
	picture: String,
	additionalEmails: [
		{
			label: String,
			email: String
		}
	],
	contactNumbers: [
		{
			label: String,
			number: String
		}
	],
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

orgProfileSchema.index({ accountId: 1, organization: 1 }, { unique: true });
orgProfileSchema.index({ externalId: 1, organization: 1 }, {
	unique: true,
	partialFilterExpression: {
		'externalId': { $exists: true, $gt: '' }
	}
});

orgProfileSchema.pre('save', function(callback) {
	//license check
	callback();
});

orgProfileSchema.virtual('id').get(function(){
	return this._id.toString();
});

orgProfileSchema.set('toJSON', {
	virtuals: true
});

orgProfileSchema.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
	if(ret.meta && ret.meta.core) delete ret.meta.core;
};

// Export the Mongoose model
export default mongoose.model('org_profiles', orgProfileSchema);