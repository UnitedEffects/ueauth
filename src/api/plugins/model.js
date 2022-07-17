import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

mongoose.set('useCreateIndex', true);
const pluginConfig = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now(),
	},
	createdBy: {
		type: String,
		required: true
	},
	version: {
		type: Number,
		required: true
	},
	notifications: {
		enabled: {
			type: Boolean,
			default: false
		},
		notificationServiceUri: String,
		registeredClientId: String
	},
	eventStream: {
		enabled: {
			type: Boolean,
			default: false
		},
		provider: {
			type: {
				type: String,
				enum: ['pulsar']
			},
			auth: {
				issuerUrl: String,
				clientId: String,
				rootRef: String, // a copy of the ROOT AG ID
				audience: String,
				scope: String
			},
			//use client credentials for API requests
			restAuth: {
				type: Boolean,
				default: false
			},
			//use client credentials for streaming
			streamAuth: {
				type: Boolean,
				default: false
			},
			adminUrl: String,
			streamUrl: String,
			lockStreamingOnceActive: {
				type: Boolean,
				default: false
			},
			setupConfig: {
				type: Object,
				/**
				 * For pulsar, the following are required
				 * clusterList
				 * adminRoles
				 */
			},
			clientConfig: {
				type: Object,
				/**
				 * For pulsar, the following are possible but not required:
				 * operationTimeoutSeconds
				 * ioThreads
				 * tlsTrustCertsFilePath
				 * tlsValidateHostname
				 * tlsAllowInsecureConnection
				 */
			},
			enableValidation: {
				type: Boolean,
				default: false
			},
			externalEventBodySchemaUrl: String //only matters if enableValidation = true
		}
	},
	mfaChallenge: {
		enabled: {
			type: Boolean,
			default: false
		},
		providers: [{
			type: {
				type: String,
				enum: ['http-proxy', 'privakey'],
				required: true
			},
			proxyClientId: String,
			proxyEnableScreen: String,
			proxyEnableInstructions: String,
			proxyEnableScreenButtonText: String,
			api: {
				domain: String,
				challenge: String,
				validate: String,
				bind: String,
				revoke: String,
				devices: String
			},
			meta: Object
		}]
	},
	resourceCreationLimiter: {
		enabled: {
			type: Boolean,
			default: false
		},
		thresholds: Object
	},
	_id: {
		type: String,
		default: uuid
	}
}, { _id: false});

// Execute before each user.save() call
pluginConfig.pre('save', callback => //console.log('log saved');
	callback());

pluginConfig.virtual('id').get(function(){
	return this._id.toString();
});

pluginConfig.set('toJSON', {
	virtuals: true
});

pluginConfig.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('plugins', pluginConfig);