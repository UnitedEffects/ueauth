import mongoose from 'mongoose';
import { uuid } from 'uuidv4';
import bcrypt from 'bcryptjs';

mongoose.set('useCreateIndex', true);

const inviteSchema = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now()
	},
	expiresAt: {
		type: Date,
		default: new Date().setDate(new Date().getDate() + 7),
		expires: 0
	},
	type: {
		type: String,
		required: true,
		enum: ['group', 'account']
	},
	sub: {
		type: String,
		required: true
	},
	email: {
		type: String,
		required: true
	},
	txt: String,
	authGroup: {
		type: String,
		required: true
	},
	passCode: String,
	accessToken: {
		type: String,
		required: true
	},
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

inviteSchema.index({ email: 1, authGroup: 1}, { unique: true });
inviteSchema.index({ sub: 1, authGroup: 1}, { unique: true });

inviteSchema.pre('save', async function(callback) {
	const invite = this;
	if (invite.isModified('passCode') || invite.isModified('accessToken')) {
		try {
			if(invite.isModified('passCode')) {
				invite.passCode = await new Promise((resolve, reject) => {
					bcrypt.genSalt(10, (err, salt) => {
						if (err) return reject(err);
						bcrypt.hash(invite.passCode, salt, (err, hash) => {
							if (err) return reject(err);
							return resolve(hash);
						});
					});
				});
			}
			if(invite.isModified('accessToken')) {
				invite.accessToken = await new Promise((resolve, reject) => {
					bcrypt.genSalt(10, (err, salt) => {
						if (err) return reject(err);
						bcrypt.hash(invite.accessToken, salt, (err, hash) => {
							if (err) return reject(err);
							return resolve(hash);
						});
					});
				});
			}
			return callback();
		} catch (error) {
			return callback(error);
		}
	} else return callback();
});

inviteSchema.methods.verifyPassCode = function(passCode) {
	return new Promise((resolve, reject) => {
		bcrypt.compare(passCode, this.passCode, (err, isMatch) => {
			if (err) return reject(err);
			return resolve(isMatch);
		});
	});
};

inviteSchema.methods.verifyAccessToken = function(accessToken) {
	return new Promise((resolve, reject) => {
		bcrypt.compare(accessToken, this.accessToken, (err, isMatch) => {
			if (err) return reject(err);
			return resolve(isMatch);
		});
	});
};

inviteSchema.virtual('id').get(function(){
	return this._id.toString();
});

inviteSchema.set('toJSON', {
	virtuals: true
});

inviteSchema.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.passCode;
	delete ret.accessToken;
	delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('invites', inviteSchema);