import mongoose from 'mongoose';
import { uuid } from 'uuidv4';

mongoose.set('useCreateIndex', true);

const payloadSchema = new mongoose.Schema({
    grantId: {
        type: String,
        index: true
    }
}, { _id: false, strict: false });

const authorizationCode = new mongoose.Schema({
    expiresAt: {
        type: Date,
        expires: 0
    },
    _id: {
        type: String,
        default: uuid
    },
    payload: payloadSchema
},{ _id: false, strict: false, collection: 'authorization_code' });

authorizationCode.pre('save', callback => {
    //console.log('session saved');
    callback();
});

export default mongoose.model('authorization_code', authorizationCode);