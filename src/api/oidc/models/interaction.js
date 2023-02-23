import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const payloadSchema = new mongoose.Schema({

}, { _id: false, strict: false });

const interaction = new mongoose.Schema({
    expiresAt: {
        type: Date,
        expires: 0
    },
    _id: {
        type: String,
        default: uuid
    },
    payload: payloadSchema
},{ _id: false, strict: false, collection: 'interaction' });

interaction.pre('save', callback => {
    //console.log('session saved');
    callback();
});

export default mongoose.model('interaction', interaction);