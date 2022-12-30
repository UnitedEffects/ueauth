import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

mongoose.set('useCreateIndex', true);

const payloadSchema = new mongoose.Schema({
	state: String,
	auth_group: String,
	code_challenge: String,
	code_verifier: String
}, { _id: false });

const pkceSession = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now,
		expires: 100
	},
	_id: {
		type: String,
		default: uuid
	},
	payload: payloadSchema
},{ _id: false, collection: 'pkce_sessions' });

pkceSession.index({ 'payload.authGroup': 1, 'payload.state': 1}, { unique: true });

pkceSession.pre('save', callback => {
	//console.log('session saved');
	callback();
});

export default mongoose.model('pkce_sessions', pkceSession);