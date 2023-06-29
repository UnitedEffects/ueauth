import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const productKey = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now
	},
	createdBy: String,
	modifiedAt: {
		type: Date,
		default: Date.now
	},
	modifiedBy: String,
	authGroup: {
		type: String,
		required: true
	},
	productId: {
		type: String,
		required: true
	},
	clientId: {
		type: String,
		required: true
	},
	organizationId: String,
	name: {
		type: String,
		required: true
	},
	description: String,
	token: {
		type: String,
		required: true
	},
	_id: {
		type: String,
		default: uuid
	},
},{ _id: false });

productKey.index({ 'authGroup': 1, 'product': 1, 'name': 1}, { unique: true });
productKey.index({ 'authGroup': 1, 'product': 1, 'token': 1}, { unique: true });
productKey.pre('save', callback => callback());

productKey.virtual('id').get(function(){
	return this._id.toString();
});

productKey.set('toJSON', {
	virtuals: true
});

productKey.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.token;
};


export default mongoose.model('product_keys', productKey);