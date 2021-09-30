import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import { nanoid } from 'nanoid';
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
	permissions: [String],
	// permissions associated to this role
	/*
	permissions: [
		{
			type: String,
			validate: {
				validator: function (v) {
					const ag = this.authGroup;
					return h.validateProductReference(mongoose.model('products'), v, ag);
				},
				message: 'Permission does not exist'
			}
		}
	],*/
	codedId: {
		type: String,
		default: nanoid(10)
	},
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

roleSchema.index({ name: 1, authGroup: 1}, { unique: true });
roleSchema.index({ codedId: 1, authGroup: 1, product: 1}, { unique: true });

roleSchema.pre('save', function(callback) {
	//license check
	callback();
});

/*roleSchema.pre('findOneAndUpdate', function(callback) {
	// deduplicate list
	this._update.associatedProducts= [...new Set(this._update.associatedProducts)];
	callback();
});*/

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
};

// Export the Mongoose model
export default mongoose.model('roles', roleSchema);