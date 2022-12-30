import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

mongoose.set('useCreateIndex', true);

const profileSchema = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now
	},
	createdBy: {
		type: String,
		default: 'SYSTEM_ADMIN'
	},
	modifiedAt: {
		type: Date,
		default: Date.now
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
		required: true
	},
	givenName: String,
	familyName: String,
	displayName: String,
	bio: String,
	picture: String,
	address: {
		street1: String,
		street2: String,
		city: String,
		state: String,
		postalCode: String,
		country: String
	},
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
	employer: String,
	title: String,
	position: String,
	personalHeader: String,
	meta: Object,
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

profileSchema.index({ accountId: 1, authGroup: 1 }, { unique: true });

profileSchema.pre('save', function(callback) {
	//license check
	callback();
});

profileSchema.virtual('id').get(function(){
	return this._id.toString();
});

profileSchema.set('toJSON', {
	virtuals: true
});

profileSchema.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
	if(ret.meta && ret.meta.core) delete ret.meta.core;
};

// Export the Mongoose model
export default mongoose.model('profiles', profileSchema);