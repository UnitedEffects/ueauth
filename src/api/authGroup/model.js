import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import keys from './generate-keys';
import ms from 'ms';

const config = require('../../config');

mongoose.set('useCreateIndex', true);

const federatedOauth2 = new mongoose.Schema({
	name: {
		type: String,
		required: true
	},
	provider: {
		type: String,
		required: true,
		enum: ['linkedin', 'custom']
	},
	buttonType: {
		type: String,
		default: 'standard',
		enum: ['linkedin', 'standard']
	},
	buttonText: {
		type: String,
		default: 'Federated Sign-in'
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
	provider: {
		type: String,
		required: true,
		enum: ['google', 'twitter', 'github', 'facebook', 'apple', 'microsoft', 'custom']
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
	aliasDnsUi: String,
	aliasDnsOIDC: String,
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
			meta: Object,
			// these customize the Login and Authorization screens and set background color gradients everywhere
			skin: {
				// background image is useful for a potential UI backdrop but is not directly implemented by this library
				backgroundImage: String,
				splashImage: {
					type: String,
					default: config.DEFAULT_UI_SKIN_SPLASH
				},
				logo: String,
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
		acrValues: [String],
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
		federate: {
			oidc: [federatedOIDC],
			oauth2: [federatedOauth2],
			saml: [Object]
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

authGroup.index({ aliasDnsUi: 1 }, {
	unique: true,
	partialFilterExpression: {
		'aliasDnsUi': { $exists: true, $gt: '' }
	}
});

authGroup.index({ aliasDnsOIDC: 1 }, {
	unique: true,
	partialFilterExpression: {
		'aliasDnsOIDC': { $exists: true, $gt: '' }
	}
});

authGroup.index({ _id: 1, 'config.federate.oidc.name': 1, 'config.federate.oidc.provider': 1 }, { unique: true });

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
	delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('auth_group', authGroup);