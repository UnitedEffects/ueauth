import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import h from '../../helper';

mongoose.set('useCreateIndex', true);

const metaSchema = new mongoose.Schema({
	// this allows us to create unique internal identifiers when required for setup.
	core: {
		type: String,
		default: uuid
	},
}, { _id: false, strict: false });

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
	codedId: {
		type: String,
		required: true
	},
	url: String,
	b2c: {
		type: Boolean,
		default: false
	},
	// indicates if this is a protected resource created as part of initialization
	core: {
		type: Boolean,
		default: false
	},
	meta: metaSchema,
	associatedClients: [
		{
			type: String,
			validate: {
				validator: function (v) {
					const ag = this.authGroup;
					return h.validateClientReference(mongoose.model('client'), v, ag);
				},
				message: 'Client does not exist in this authGroup'
			}
		}
	],
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

productSchema.index({ name: 1, authGroup: 1}, { unique: true });
productSchema.index({ codedId: 1, authGroup: 1}, { unique: true });
productSchema.index({ 'meta.core': 1, authGroup: 1}, { unique: true });

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
	//delete ret.core;
	if(ret.meta && ret.meta.core) delete ret.meta.core;
};

// Export the Mongoose model
export default mongoose.model('products', productSchema);