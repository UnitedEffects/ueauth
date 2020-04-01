import mongoose from 'mongoose';
import { uuid } from 'uuidv4';

mongoose.set('useCreateIndex', true);

const payloadSchema = new mongoose.Schema({

}, { _id: false, strict: false });

const client = new mongoose.Schema({
    expiresAt: {
        type: Date,
        expires: 0
    },
    _id: {
        type: String,
        default: uuid
    },
    payload: payloadSchema
},{ _id: false, strict: false, collection: 'client' });

client.pre('save', callback => {
    //console.log('session saved');
    callback();
});

export default mongoose.model('client', client);