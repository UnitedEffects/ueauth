import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

mongoose.set('useCreateIndex', true);

const orgSchema = new mongoose.Schema({
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
	name: {
		type: String,
		required: true
	},
	active: {
		type: Boolean,
		default: true
	},
	description: String,
	type: {
		type: String,
		default: 'customer',
		enum: ['customer', 'external', 'internal', 'other']
	},
	contactName: String,
	contactAddress: String,
	contactPhone: String,
	externalId: String,
	metadata: Object,
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

orgSchema.index({ name: 1, authGroup: 1}, { unique: true });


orgSchema.pre('save', function(callback) {
	//license check
	callback();
});

orgSchema.virtual('id').get(function(){
	return this._id.toString();
});

orgSchema.set('toJSON', {
	virtuals: true
});

orgSchema.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('organizations', orgSchema);