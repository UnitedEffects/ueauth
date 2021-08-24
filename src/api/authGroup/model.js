import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import keys from './generate-keys';
import ms from "ms";

mongoose.set('useCreateIndex', true);

const authGroup = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now()
	},
	modifiedAt: {
		type: Date,
		default: Date.now()
	},
	securityExpiration: {
		type: Date,
		expires: 0
	},
	modifiedBy: {
		type: String,
		default: 'SYSTEM_ADMIN'
	},
	active: {
		type: Boolean,
		default: false
	},
	owner: {
		type: String,
		required: true
	},
	prettyName: {
		type: String,
		unique: true
	},
	name: {
		type: String,
		required: true
	},
	metadata: Object,
	primaryDomain: String,
	primaryTOS: String,
	primaryPrivacyPolicy: String,
	config: {
		keys: Array,
		requireVerified: {
			type: Boolean,
			default: false
		},
		// if true, send a verify email on account creation
		autoVerify: {
			type: Boolean,
			default: false
		},
		// if true, passwordless (magic-link) is supported
		passwordLessSupport: {
			type: Boolean,
			default: false
		},
		// if true, allows UI based password reset to be initiated
		centralPasswordReset: {
			type: Boolean,
			default: true
		},
		ttl: {
			accessToken: {
				type: Number,
				default: ms('1h') / 1000
			},
			authorizationCode: {
				type: Number,
				default: ms('10m') / 1000
			},
			clientCredentials: {
				type: Number,
				default: ms('1h') / 1000,
			},
			deviceCode: {
				type: Number,
				default: ms('1h') / 1000
			},
			idToken: {
				type: Number,
				default: ms('1h') / 1000
			},
			refreshToken: {
				type: Number,
				default: ms('1d') / 1000
			},
			interaction: {
				type: Number,
				default: ms('1h') / 1000
			},
			session: {
				type: Number,
				default: ms('10d') / 1000
			},
			grant: {
				type: Number,
				default: ms('10d') / 1000
			}
		}
	},
	pluginOptions: {
		notification: {
			enabled: {
				type: Boolean,
				default: false
			},
			ackRequiredOnOptional: {
				type: Boolean,
				default: false
			},
			/*
			The customService option is a future feature and not yet implemented
			 */
			customService: {
				enabled: {
					type: Boolean,
					default: false
				},
				url: String,
				clientId: String,
				customApiKey: {
					enabled: Boolean,
					key: String
				}
			},
		}
	},
	locked: {
		type: Boolean,
		default: false
	},
	associatedClient: String,
	_id: {
		type: String,
		default: nanoid
	}
},{ _id: false });

// Execute before each user.save() call
authGroup.pre('save', async function(next) {
	if(!this.prettyName) this.prettyName = this._id;
	if(this.config.keys.length === 0) {
		this.config.keys = await keys.write();
	}
	next();
});

authGroup.virtual('id').get(function(){
	return this._id.toString();
});

authGroup.set('toJSON', {
	virtuals: true
});

authGroup.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.active;
	delete ret.owner;
	delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('auth_group', authGroup);