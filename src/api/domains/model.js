import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import h from "../../helper";

mongoose.set('useCreateIndex', true);
const metaSchema = new mongoose.Schema({
	// this allows us to create unique internal identifiers when required for setup.
	admin: {
		type: String,
		default: `unique-placeholder-${uuid}`
	},
}, { _id: false, strict: false });

const domainSchema = new mongoose.Schema({
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
	organization: {
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
	// products from the organization now associated to this domain
	associatedOrgProducts: [
		{
			type: String,
			validate: {
				validator: function (v) {
					return h.validateOrgProductReference(mongoose.model('organizations'), this.organization, this.authGroup, v);
				},
				message: 'Product does not exist as part of the organization'
			}
		}
	],
	// indicates if this is a protected resource created as part of initialization
	core: {
		type: Boolean,
		default: false
	},
	meta: metaSchema,
	externalId: String,
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

domainSchema.index({ name: 1, organization: 1, authGroup: 1 }, { unique: true });
domainSchema.index({ 'meta.admin': 1, organization: 1, authGroup: 1 }, { unique: true });


domainSchema.pre('save', function(callback) {
	//license check
	callback();
});

domainSchema.pre('findOneAndUpdate', function(callback) {
	// deduplicate list
	this._update.associatedOrgProducts= [...new Set(this._update.associatedOrgProducts)];
	callback();
});

domainSchema.virtual('id').get(function(){
	return this._id.toString();
});

domainSchema.set('toJSON', {
	virtuals: true
});

domainSchema.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
	delete ret.core;
};

// Export the Mongoose model
export default mongoose.model('domains', domainSchema);