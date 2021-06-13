import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

mongoose.set('useCreateIndex', true);

const payloadSchema = new mongoose.Schema({
    auth_group: {
        type: String,
        required: true,
        index: true
    },
    client_name: {
        type: String,
        required: true
    }
}, { _id: false, strict: false });

const client = new mongoose.Schema({
    _id: {
        type: String,
        default: uuid
    },
    payload: payloadSchema
},{ _id: false, strict: false, collection: 'client' });

client.index({ 'payload.client_name': 1, 'payload.auth_group': 1}, { unique: true });

client.pre('save', callback => {
    //console.log('session saved');
    callback();
});

export default mongoose.model('client', client);