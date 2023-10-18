import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

const passwordHistories = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now,
		expires: '365d'
	},
	authGroup: {
		type: String,
		required: true
	},
	accountId: {
		type: String,
		required: true
	},
	value: {
		type: String,
		required: true
	},
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

passwordHistories.pre('save', async function (next) {
	try {
		const history = this;
		if (!history.isModified('value')) return next();
		if(history.isModified('value')) {
			history.value = await bcrypt.hash(history.value, await bcrypt.genSalt(10));
		}
		return next();
	} catch (error) {
		return next(error);
	}
});

passwordHistories.methods.verifyPassword = async function(value) {
	return bcrypt.compare(value, this.value);
};

// Virtuals not needed, no one will ever see this data. Internal use only.

// Export the Mongoose model
export default mongoose.model('p-history', passwordHistories);