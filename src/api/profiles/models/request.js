import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

mongoose.set('useCreateIndex', true);

const requestProfile = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now(),
		expires: '7d'
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
	requestingAccountId: {
		type: String,
		required: true
	},
	requestingEmail: String,
	requestDetails: String,
	dataCallback: String,
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
		enum: ['1d', '7d', '30d', '90d', '180d', '360d', 'unlimited']
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