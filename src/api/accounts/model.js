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
	recoverCodes: [String],
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

accountSchema.index({ email: 1, authGroup: 1}, { unique: true });
accountSchema.index({ username: 1, authGroup: 1}, { unique: true });
accountSchema.index( { authGroup: 1, _id: 1, 'identities.id' : 1 }, { unique: true });
accountSchema.index( { email: 'text', username: 'text' });

accountSchema.pre('save', async function (next) {
	try {
		const account = this;
		if (!account.isModified('password') && !account.isModified('recoverCodes')) return next();
		if(account.isModified('password')) {
			account.password = await bcrypt.hash(account.password, await bcrypt.genSalt(10));
		}
		if(account.isModified('recoverCodes')) {
			if (account?.recoverCodes?.length > 0) {
				if(account.recoverCodes.length !== 10) throw new Error('Must have exactly 10 codes');
				const codes = [];
				await Promise.all(account.recoverCodes.map(async (code) => {
					codes.push(await bcrypt.hash(code, await bcrypt.genSalt(12)));
					return code;
				}));
				account.recoverCodes = codes;
			}
		}
		return next();
	} catch (error) {
		return next(error);
	}
});

accountSchema.methods.verifyPassword = async function(password) {
	return bcrypt.compare(password, this.password);
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
	delete ret.recoverCodes;
};

// Export the Mongoose model
export default mongoose.model('accounts', accountSchema);