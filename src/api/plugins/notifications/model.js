import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const notificationSchema = new mongoose.Schema({
	_id: {
		type: String,
		default: uuid
	},
	createdAt: {
		type: Date,
		default: Date.now(),
		expires: '30d'
	},
	createdBy: {
		type: String,
		required: true
	},
	iss: String,
	type: {
		type: String,
		enum: ['general', 'forgotPassword', 'passwordless', 'verify']
	},
	formats: {
		type: [String],
		enum: ['email', 'sms']
	},
	recipientUserId: String,
	recipientEmail: String,
	recipientSms: String,
	authGroupId: {
		type: String,
		required: true
	},
	screenUrl: String,
	subject: String,
	message: String,
	destinationUri: {
		type: String,
		required: true
	},
	processed: {
		type: Boolean,
		default: false
	},
	// context for customers (those without primary organization access)
	organization: String,
	branding: Object,
	meta: Object
}, { _id: false});

// Execute before each user.save() call
notificationSchema.pre('save', callback => //console.log('log saved');
	callback());

notificationSchema.virtual('id').get(function(){
	return this._id.toString();
});

notificationSchema.set('toJSON', {
	virtuals: true
});

notificationSchema.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('notifications', notificationSchema);