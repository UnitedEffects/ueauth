import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

mongoose.set('useCreateIndex', true);

const viewProfileAccess = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now()
	},
	createdBy: {
		type: String,
		default: 'SYSTEM_ADMIN'
	},
	expiresAt: {
		type: Date,
		expires: 0
	},
	authGroup: {
		type: String,
		required: true
	},
	viewingAccountId: {
		type: String,
		required: true
	},
	viewingEmail: String,
	client: {
		type: Boolean,
		default: false
	},
	accessDetails: String,
	targetAccountId: {
		type: String,
		required: true
	},
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

viewProfileAccess.pre('save', function(callback) {
	callback();
});

viewProfileAccess.virtual('id').get(function(){
	return this._id.toString();
});

viewProfileAccess.set('toJSON', {
	virtuals: true
});

viewProfileAccess.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('profile_access', viewProfileAccess);