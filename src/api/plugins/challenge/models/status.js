import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const transactionChallengeSchema = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now,
		expires: 600
	},
	_id: {
		type: String,
		default: uuid
	},
	uid: {
		type: String,
		required: true
	},
	providerKey: {
		type: String,
		required: true
	},
	authGroup: {
		type: String,
		required: true
	},
	accountId: {
		type: String,
		required: true
	},
	state: {
		type: String,
		enum: ['pending', 'approved', 'denied']
	}
},{ _id: false, collection: 'transaction_challenges' });

transactionChallengeSchema.index({
	'authGroup': 1,
	'providerKey': 1,
	'accountId': 1,
	'uid': 1 }, { unique: true });

transactionChallengeSchema.pre('save', callback => {
	callback();
});

export default mongoose.model('transaction_challenges', transactionChallengeSchema);