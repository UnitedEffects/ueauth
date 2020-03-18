import mongoose from 'mongoose';
mongoose.Promise = Promise;
import moment from 'moment';
import { uuid } from 'uuidv4';

mongoose.set('useCreateIndex', true);
const logSchema = new mongoose.Schema({
    logTimestamp: {
        type: Date,
        default: moment().format(),
        expires: '30d'
    },
    code: {
        type: String,
        required: false
    },
    message: {
        type: String,
        required: true
    },
    details: {
        type: Object,
        required: false
    },
    _id: {
        type: String,
        default: uuid
    }
},{ _id: false });

// Execute before each user.save() call
logSchema.pre('save', callback => //console.log('log saved');
    callback());

// Export the Mongoose model
export default mongoose.model('Log', logSchema);