import mongoose from 'mongoose';
import { uuid } from 'uuidv4';

mongoose.set('useCreateIndex', true);

const payloadSchema = new mongoose.Schema({
    auth_group: {
        type: String,
        required: true,
        index: true
    }
}, { _id: false, strict: false });

const client = new mongoose.Schema({
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