import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

mongoose.set('useCreateIndex', true);

const snapShotSchema = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now,
		expires: '24h'
	},
	createdBy: {
		type: String,
		default: 'SYSTEM_ADMIN'
	},
	authGroup: {
		type: String,
		required: true
	},
	requestId: {
		type: String,
		required: true,
		unique: true
	},
	callerId: {
		type: String,
		required: true
	},
	accountId: {
		type: String,
		required: true
	},
	status: {
		type: String,
		default: 'pending',
		enum: ['pending', 'approved', 'denied']
	},
	snapShot: Object,
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

snapShotSchema.pre('save', function(callback) {
	//license check
	callback();
});

snapShotSchema.virtual('id').get(function(){
	return this._id.toString();
});

snapShotSchema.set('toJSON', {
	virtuals: true
});

snapShotSchema.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
	if(ret.meta && ret.meta.core) delete ret.meta.core;
};

// Export the Mongoose model
export default mongoose.model('profile_snapshot', snapShotSchema);