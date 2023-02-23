import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const payloadSchema = new mongoose.Schema({

}, { _id: false, strict: false });

const pushedAuthorizationRequest = new mongoose.Schema({
    expiresAt: {
        type: Date,
        expires: 0
    },
    _id: {
        type: String,
        default: uuid
    },
    payload: payloadSchema
},{ _id: false, strict: false, collection: 'pushed_authorization_request' });

pushedAuthorizationRequest.pre('save', callback => {
    //console.log('session saved');
    callback();
});

export default mongoose.model('pushed_authorization_request', pushedAuthorizationRequest);