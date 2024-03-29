import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const payloadSchema = new mongoose.Schema({
	auth_group: {
		type: String,
		required: true,
		index: true
	},
	client_name: {
		type: String,
		required: true
	},
	associated_product: String,
	initialized_org_context: String,
	client_label: String,
	register_url: String,
	client_skip_consent: Boolean,
	client_only_passwordless: Boolean,
	client_optional_skip_logout_prompt: Boolean,
	client_federation_options: Boolean,
	client_allow_org_self_identify: Boolean,
	client_skip_to_federated: Boolean,
	dynamic_scope: String
}, { _id: false, strict: false });

const accessSchema = new mongoose.Schema({
	product: String,
	roles: [String]
}, { _id: false });

const client = new mongoose.Schema({
	_id: {
		type: String,
		default: uuid
	},
	payload: payloadSchema,
	access: accessSchema
},{ _id: false, strict: false, collection: 'client' });

client.index({ 'payload.client_name': 1, 'payload.auth_group': 1}, { unique: true });
client.index( { 'payload.client_name': 'text', _id: 'text' });

client.pre('save', callback => {
	//console.log('session saved');
	callback();
});

export default mongoose.model('client', client);