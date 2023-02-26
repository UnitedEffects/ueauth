import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const requestProfile = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now,
		expires: '7d'
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
	requestingAccountId: {
		type: String,
		required: true
	},
	requestingEmail: String,
	requestDetails: String,
	// is this a person or a machine?
	client: {
		type: Boolean,
		default: false
	},
	dataCallback: String,
	orgId: String,
	targetAccountId: {
		type: String,
		required: true
	},
	type: {
		type: String,
		default: 'copy',
		enum: ['copy', 'sync', 'access']
	},
	accessExpirationTime: {
		type: String,
		default: 'unlimited',
		enum: ['1', '7', '30', '90', '180', '360', 'unlimited']
	},
	state: {
		type: String,
		default: 'new',
		enum: ['new', 'approved', 'denied']
	},
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

requestProfile.pre('save', function(callback) {
	callback();
});

requestProfile.virtual('id').get(function(){
	return this._id.toString();
});

requestProfile.set('toJSON', {
	virtuals: true
});

requestProfile.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('profile_requests', requestProfile);