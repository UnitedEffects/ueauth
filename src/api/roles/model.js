import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import h from '../../helper';
mongoose.set('useCreateIndex', true);

const roleSchema = new mongoose.Schema({
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
	custom: {
		type: Boolean,
		default: false
	},
	// add validator that only allows organization to be set if custom is true
	organization: String,
	product: {
		type: String,
		required: true
	},
	productCodedId: String,
	permissions: [
		{
			type: String,
			validate: {
				validator: function (v) {
					return h.validatePermissionReference(mongoose.model('permissions'), v, this.authGroup, this.product);
				},
				message: 'Permission does not exist or is not part of this product. Also make sure you provide value as a concat of \'permission.id permission.coded\' where there is a space between the values.'
			}
		}
	],
	codedId: {
		type: String,
		required: true
	},
	core: {
		type: Boolean,
		default: false
	},
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

roleSchema.index({ name: 1, authGroup: 1, product: 1}, { unique: true });
roleSchema.index({ codedId: 1, authGroup: 1, product: 1}, { unique: true });

roleSchema.pre('save', function(callback) {
	//license check
	callback();
});

roleSchema.pre('findOneAndUpdate', function(callback) {
	// deduplicate list
	this._update.permissions = [...new Set(this._update.permissions)];
	callback();
});

roleSchema.virtual('id').get(function(){
	return this._id.toString();
});

roleSchema.set('toJSON', {
	virtuals: true
});

roleSchema.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
	delete ret.core;
};

// Export the Mongoose model
export default mongoose.model('roles', roleSchema);