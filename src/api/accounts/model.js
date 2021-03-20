import mongoose from 'mongoose';
import { uuid } from 'uuidv4';
import bcrypt from 'bcryptjs';

mongoose.set('useCreateIndex', true);

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
	txt: String,
	verified: {
		type: Boolean,
		default: true //make this false once validation is enabled
	},
	active: {
		type: Boolean,
		default: true
	},
	metadata: Object,
	organizations: [{
		name: String,
		domains: [String]
	}],
	roles: [String],
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

accountSchema.index({ email: 1, authGroup: 1}, { unique: true });
accountSchema.index({ username: 1, authGroup: 1}, { unique: true });

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
	delete ret.blocked;
	delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('accounts', accountSchema);