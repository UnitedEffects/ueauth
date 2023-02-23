import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const payloadSchema = new mongoose.Schema({

}, { _id: false, strict: false });

const clientCredentials = new mongoose.Schema({
    expiresAt: {
        type: Date,
        expires: 0
    },
    _id: {
        type: String,
        default: uuid
    },
    payload: payloadSchema
},{ _id: false, strict: false, collection: 'client_credentials' });

clientCredentials.pre('save', callback => {
    //console.log('session saved');
    callback();
});

export default mongoose.model('client_credentials', clientCredentials);