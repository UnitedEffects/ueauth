import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import keys from './generate-keys';
import ms from "ms";

const config = require('../../config');

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
	registerUrl: String,
	primaryEmail: String,
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
		scopes: [String],
		// if true, logins must use pkce
		pkceRequired: {
			type: Boolean,
			default: false
		},
		ui: {
			// fullCustom is for a future update that allows the AG to implement a fully custom UI of their choosing
			// keeping this false until later
			fullCustom: {
				type: Boolean,
				default: false
			},
			// these customize the Login and Authorization screens and set background color gradients everywhere
			skin: {
				splashImage: {
					type: String,
					default: config.DEFAULT_UI_SKIN_SPLASH
				},
				bgGradientLow: {
					type: String,
					default: config.DEFAULT_UI_SKIN_GRADIENT_LOW
				},
				bgGradientHigh: {
					type: String,
					default: config.DEFAULT_UI_SKIN_GRADIENT_HIGH
				}
			}
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
		},
		// this may not work very well in a serverless function environment
		eventEmitterCleanSensative: {
			type: Boolean,
			default: true
		},
		eventEmitter: {
			general: {
				type: Boolean,
				default: true //jwks, discovery, server_error, revocation
			},
			accessToken: {
				type: Boolean,
				default: false
			},
			authorization: {
				type: Boolean,
				default: false
			},
			backchannel: {
				type: Boolean,
				default: false
			},
			clientCredentials: {
				type: Boolean,
				default: false
			},
			deviceCode: {
				type: Boolean,
				default: false
			},
			session: {
				type: Boolean,
				default: false
			},
			grant: {
				type: Boolean,
				default: false
			},
			iat: { //initial access token
				type: Boolean,
				default: false
			},
			uiInteraction: {
				type: Boolean,
				default: false
			},
			replayDetection: {
				type: Boolean,
				default: false
			},
			pushedAuthorization: {
				type: Boolean,
				default: false
			},
			refreshToken: {
				type: Boolean,
				default: false
			},
			registration: {
				type: Boolean,
				default: false
			},
			account: {
				type: Boolean,
				default: false // includes user_info errors
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