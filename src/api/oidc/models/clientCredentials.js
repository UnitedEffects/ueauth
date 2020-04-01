import mongoose from 'mongoose';
import { uuid } from 'uuidv4';

mongoose.set('useCreateIndex', true);

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