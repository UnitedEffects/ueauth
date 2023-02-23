import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const payloadSchema = new mongoose.Schema({
    grantId: {
        type: String,
        index: true
    },
    userCode: {
        type: String,
        unique: true
    }
}, { _id: false, strict: false });

const deviceCode = new mongoose.Schema({
    expiresAt: {
        type: Date,
        expires: 0
    },
    _id: {
        type: String,
        default: uuid
    },
    payload: payloadSchema
},{ _id: false, strict: false, collection: 'device_code' });

deviceCode.pre('save', callback => {
    //console.log('session saved');
    callback();
});

export default mongoose.model('device_code', deviceCode);