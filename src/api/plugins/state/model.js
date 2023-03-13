import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const stateCheck = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now,
		expires: 600
	},
	_id: {
		type: String,
		default: uuid
	},
	stateValue: {
		type: String,
		required: true
	},
	authGroup: {
		type: String,
		required: true
	},
	account: String
},{ _id: false, collection: 'challenge-state-checks' });

stateCheck.index({
	'authGroup': 1,
	'stateValue': 1,
	'account': 1
}, { unique: true });

stateCheck.pre('save', callback => {
	callback();
});

export default mongoose.model('challenge-state-checks', stateCheck);