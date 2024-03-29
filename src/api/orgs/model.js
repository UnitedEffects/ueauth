import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import h from '../../helper';

const federatedSAML = new mongoose.Schema({
	name: {
		type: String,
		required: true
	},
	buttonType: {
		type: String,
		default: 'standard',
		enum: ['google', 'microsoft', 'standard']
	},
	buttonText: {
		type: String,
		default: 'Federated Sign-in'
	},
	idpCertificates: {
		type: [String],
		required: true
	},
	spCertificate: {
		type: String,
		required: true
	},
	spPrivateKey: {
		type: String,
		required: true
	},
	ssoLoginUrl: {
		type: String,
		required: true
	},
	ssoLogoutUrl: {
		type: String,
		required: true
	},
	forceLogin: {
		type: Boolean,
		default: false
	},
	signRequest: {
		type: Boolean,
		default: false
	},
	allowUnencryptedAssertion: {
		type: Boolean,
		default: true
	}
}, { _id: false, strict: false });

const federatedOauth2 = new mongoose.Schema({
	name: {
		type: String,
		required: true
	},
	buttonType: {
		type: String,
		default: 'standard',
		enum: ['standard']
	},
	buttonText: {
		type: String,
		default: 'Your Company SSO'
	},
	PKCE: {
		type: Boolean,
		default: false
	},
	client_id: String,
	client_secret: String,
	response_type: {
		type: String,
		default: 'code',
		enum: ['code']
	},
	grant_type: {
		type: String,
		default: 'authorization_code',
		enum: ['authorization_code']
	},
	scopes: [String],
	accessTokenUri: String,
	authorizationUri: String,
	profileUri: String
}, { _id: false, strict: false });

const federatedOIDC = new mongoose.Schema({
	name: {
		type: String,
		required: true
	},
	buttonType: {
		type: String,
		default: 'standard',
		enum: ['standard']
	},
	buttonText: {
		type: String,
		default: 'Your Company SSO'
	},
	PKCE: {
		type: Boolean,
		default: false
	},
	client_id: String,
	client_secret: String,
	response_type: {
		type: String,
		default: 'code'
	},
	grant_type: {
		type: String,
		default: 'authorization_code'
	},
	discovery_url: {
		type: String,
		required: true
	},
	scopes: [String]
}, { _id: false, strict: false });

const orgSchema = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now
	},
	createdBy: {
		type: String,
		default: 'SYSTEM_ADMIN'
	},
	modifiedAt: {
		type: Date,
		default: Date.now
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
	contactEmail: String,
	contactName: String,
	contactAddress: String,
	contactPhone: String,
	externalId: String,
	alias: String,
	metadata: Object,
	// products purchased/licensed/accessed by the organization
	associatedProducts: [
		{
			type: String,
			validate: {
				validator: function (v) {
					const doc = (this.authGroup) ? this : this._update.$set;
					const ag = doc.authGroup;
					const core = doc.core;
					return h.validateProductReference(mongoose.model('products'), v, ag, core);
				},
				message: 'Product does not exist or is not allowed'
			}
		}
	],
	// indicates if this is a protected resource created as part of initialization
	core: {
		type: Boolean,
		default: false
	},
	emailDomains: Array,
	access: {
		required: {
			type: Boolean,
			default: false
		},
		terms: String,
		termsVersion: String,
		disableAccessOnChange: {
			type: Boolean,
			default: false
		}
	},
	profileNotifications: {
		type: Boolean,
		default: false
	},
	restrictEmailDomains: {
		type: Boolean,
		default: false
	},
	ssoLimit: {
		type: Boolean,
		default: false
	},
	sso: {
		oidc: federatedOIDC,
		oauth2: federatedOauth2,
		saml: federatedSAML
	},
	ssoEmailDomain: String,
	ssoAddAccountToOrg: {
		type: Boolean,
		default: false
	},
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

orgSchema.index({ name: 1, authGroup: 1}, { unique: true });
orgSchema.index( { alias: 'text', name: 'text', description: 'text', contactName: 'text' });
orgSchema.index({ authGroup: 1, externalId: 1 }, {
	unique: true,
	partialFilterExpression: {
		'externalId': { $exists: true, $gt: '' }
	}
});
orgSchema.index({ authGroup: 1, alias: 1 }, {
	unique: true,
	partialFilterExpression: {
		'alias': { $exists: true, $gt: '' }
	}
});
orgSchema.index({ authGroup: 1, ssoEmailDomain: 1 }, {
	unique: true,
	partialFilterExpression: {
		ssoEmailDomain: { $exists: true, $gt: '' }
	}
});

orgSchema.index({ authGroup: 1, core: 1 }, {
	unique: true,
	partialFilterExpression: {
		'core': { $exists: true, $eq: true }
	}
});

orgSchema.pre('save', function(callback) {
	callback();
});

orgSchema.pre('findOneAndUpdate', function(callback) {
	// deduplicate list
	this._update.associatedProducts= [...new Set(this._update.associatedProducts)];
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