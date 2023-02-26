import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const payloadSchema = new mongoose.Schema({
	authGroup: String,
	accountId: String,
	clientId: String,
	sessionUid: String,
	federatedToken: String
}, { _id: false });

const fedTokenCache = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now,
	},
	expiresAt: {
		type: Date,
		expires: 0
	},
	_id: {
		type: String,
		default: uuid
	},
	payload: payloadSchema
},{ _id: false });

fedTokenCache.index({ 'payload.authGroup': 1, 'payload.accountId': 1, 'payload.clientId': 1, 'payload.grantId': 1 }, { unique: true });

fedTokenCache.pre('save', callback => {
	//console.log('session saved');
	callback();
});

export default mongoose.model('federated_tokens', fedTokenCache);