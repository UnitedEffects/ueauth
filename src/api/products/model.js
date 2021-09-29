import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

mongoose.set('useCreateIndex', true);

const productSchema = new mongoose.Schema({
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
	description: String,
	type: {
		type: String,
		enum: ['global', 'app', 'service', 'module', 'domain', 'entity', 'other']
	},
	_id: {
		type: String,
		default: nanoid
	}
},{ _id: false });

productSchema.index({ name: 1, authGroup: 1}, { unique: true });


productSchema.pre('save', function(callback) {
	//license check
	callback();
});

productSchema.virtual('id').get(function(){
	return this._id.toString();
});

productSchema.set('toJSON', {
	virtuals: true
});

productSchema.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('products', productSchema);