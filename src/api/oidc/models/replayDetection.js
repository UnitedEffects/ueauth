import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

mongoose.set('useCreateIndex', true);

const payloadSchema = new mongoose.Schema({

}, { _id: false, strict: false });

const replayDetection = new mongoose.Schema({
    expiresAt: {
        type: Date,
        expires: 0
    },
    _id: {
        type: String,
        default: uuid
    },
    payload: payloadSchema
},{ _id: false, strict: false, collection: 'replay_detection' });

replayDetection.pre('save', callback => {
    //console.log('session saved');
    callback();
});

export default mongoose.model('replay_detection', replayDetection);