import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

mongoose.set('useCreateIndex', true);

const payloadSchema = new mongoose.Schema({
    uid: {
        type: String,
        unique: true
    }
}, { _id: false, strict: false });

const sessionSchema = new mongoose.Schema({
    expiresAt: {
        type: Date,
        expires: 0
    },
    _id: {
        type: String,
        default: uuid
    },
    payload: payloadSchema
},{ _id: false, strict: false, collection: 'session' });

sessionSchema.pre('save', callback => {
    //console.log('session saved');
    callback();
});

export default mongoose.model('session', sessionSchema);