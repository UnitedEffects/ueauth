import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import keys from './generate-keys';

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
	primaryDomain: String, //todo add this as part of init
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
		passwordLessSupport: {
			email: {
				type: Boolean,
				default: true
			},
			sms: {
				type: Boolean,
				default: false
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