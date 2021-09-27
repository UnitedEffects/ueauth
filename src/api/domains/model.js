import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

mongoose.set('useCreateIndex', true);

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
	associatedOrgProducts: [{
		id: String
	}],
	externalId: String,
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

domainSchema.index({ name: 1, organization: 1}, { unique: true });


domainSchema.pre('save', function(callback) {
	//license check
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
};

// Export the Mongoose model
export default mongoose.model('domains', domainSchema);