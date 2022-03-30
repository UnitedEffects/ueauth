import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
mongoose.set('useCreateIndex', true);

const orgCongtextSession = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now(),
		expires: '12h'
	},
	authGroup: {
		type: String,
		required: true
	},
	uid: {
		type: String,
		required: true
	},
	clientId: {
	    type: String,
		required: true
	},
	session: String,
	state: {
		type: String,
		required: true
	},
	accountId: {
		type: String,
		required: true
	},
	orgContext: {
		type: String,
		required: true
	},
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

orgCongtextSession.index({ authGroup: 1, accountId: 1, state: 1 }, { unique: true });
orgCongtextSession.pre('save', callback => callback() );

orgCongtextSession.virtual('id').get(function(){
	return this._id.toString();
});

orgCongtextSession.set('toJSON', {
	virtuals: true
});

orgCongtextSession.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('org-context-sessions', orgCongtextSession);