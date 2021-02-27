import mongoose from 'mongoose';
import { uuid } from 'uuidv4';

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
	notifications: {
		enabled: {
			type: Boolean,
			default: false
		},
		notificationServiceUri: String,
		registeredClientId: {
			type: String,
			required: true
		},
		registeredClientName: {
			type: String,
			required: true
		}
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