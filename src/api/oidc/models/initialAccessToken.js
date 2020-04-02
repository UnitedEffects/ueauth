import mongoose from 'mongoose';
import { uuid } from 'uuidv4';

mongoose.set('useCreateIndex', true);

const payloadSchema = new mongoose.Schema({

}, { _id: false, strict: false });

const initialAccessToken = new mongoose.Schema({
    expiresAt: {
        type: Date,
        expires: 0
    },
    _id: {
        type: String,
        default: uuid
    },
    payload: payloadSchema
},{ _id: false, strict: false, collection: 'initial_access_token' });

initialAccessToken.pre('save', callback => {
    //console.log('session saved');
    callback();
});

export default mongoose.model('initial_access_token', initialAccessToken);