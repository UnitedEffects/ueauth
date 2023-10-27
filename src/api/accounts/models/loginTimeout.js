import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const loginTimeout = new mongoose.Schema({
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true,
        expires: 0
    },
    authGroup: {
        type: String,
        required: true
    },
    accountId: {
        type: String,
        required: true
    },
    _id: {
        type: String,
        default: uuid
    }
},{ _id: false });

loginTimeout.index({ accountId: 1, authGroup: 1}, { unique: true });

loginTimeout.virtual('id').get(function(){
    return this._id.toString();
});

loginTimeout.set('toJSON', {
    virtuals: true
});

loginTimeout.options.toJSON.transform = function (doc, ret, options) {
    ret.id = ret._id;
    delete ret._id;
};

export default mongoose.model('login-timout', loginTimeout);