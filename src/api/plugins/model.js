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
			api: {
				domain: String,
				challenge: String,
				validate: String
			}
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