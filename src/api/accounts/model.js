import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

mongoose.set('useCreateIndex', true);

const identitySchema = new mongoose.Schema({
	id: {
		type: String,
		required: true
	},
	provider: {
		type: String,
		required: true
	},
	profile: Object
}, { _id: false });

const accountSchema = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now()
	},
	modifiedAt: {
		type: Date,
		default: Date.now()
	},
	modifiedBy: {
		type: String,
		default: 'SYSTEM_ADMIN'
	},
	username: {
		type: String,
		required: true
	},
	email: {
		type: String,
		required: true
	},
	blocked: {
		type: Boolean,
		default: false
	},
	authGroup: {
		type: String,
		required: true
	},
	password: {
		type: String,
		required: true
	},
	phone: {
		txt: String,
	},
	verified: {
		type: Boolean,
		default: false
	},
	active: {
		type: Boolean,
		default: true
	},
	mfa: {
		enabled: Boolean
	},
	// organization.domains.products.roles.permissions
	// every entry is a flattened org.domain.role
	access: [
		{
			organization: {
				id: String,
				domains: [String],
				roles: [String],
				terms: {
					required: {
						type: Boolean,
						default: false
					},
					accepted: {
						type: Boolean,
						default: false
					},
					termsDeliveredOn: Date,
					termsOfAccess: String,
					termsAcceptedOn: Date,
					termsVersion: String
				}
			}
		}
	],
	metadata: Object,
	identities: [identitySchema],
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

accountSchema.index({ email: 1, authGroup: 1}, { unique: true });
accountSchema.index({ username: 1, authGroup: 1}, { unique: true });
accountSchema.index( { authGroup: 1, _id: 1, 'identities.id' : 1 }, { unique: true });
accountSchema.index( { email: 'text', username: 'text' });

accountSchema.pre('save', function(callback) {
	const account = this;
	if (!account.isModified('password')) return callback();

	// Password changed so we need to hash it
	bcrypt.genSalt(10, (err, salt) => {
		if (err) return callback(err);

		bcrypt.hash(account.password, salt, (err, hash) => {
			if (err) return callback(err);
			account.password = hash;
			callback();
		});
	});
});

accountSchema.methods.verifyPassword = function(password) {
	return new Promise((resolve, reject) => {
		bcrypt.compare(password, this.password, (err, isMatch) => {
			if (err) return reject(err);
			return resolve(isMatch);
		});
	});
};

accountSchema.virtual('id').get(function(){
	return this._id.toString();
});

accountSchema.set('toJSON', {
	virtuals: true
});

accountSchema.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.password;
	delete ret.access;
	delete ret.phone;
	delete ret.__v;
	delete ret.identities;
};

// Export the Mongoose model
export default mongoose.model('accounts', accountSchema);