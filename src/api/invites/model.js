import mongoose from 'mongoose';
import { uuid } from 'uuidv4';

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
		enum: ['owner', 'access']
	},
	sub: {
		type: String,
		required: true
	},
	authGroup: {
		type: String,
		required: true
	},
	resources: [
		{
			resourceType: {
				type: String,
				required: true
			},
			resourceId: {
				type: String,
				required: true
			},
		}
	],
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

inviteSchema.index({ type: 1, sub: 1, authGroup: 1, 'resources.resourceType': 1, 'resources.resourceId': 1}, { unique: true });

inviteSchema.pre('save', async function(callback) {
	return callback();
});

inviteSchema.virtual('id').get(function(){
	return this._id.toString();
});

inviteSchema.set('toJSON', {
	virtuals: true
});

inviteSchema.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('invites', inviteSchema);