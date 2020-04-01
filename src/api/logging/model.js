import mongoose from 'mongoose';
import { uuid } from 'uuidv4';

mongoose.set('useCreateIndex', true);
const logSchema = new mongoose.Schema({
    logTimestamp: {
        type: Date,
        default: Date.now(),
        expires: '30d'
    },
    code: {
        type: String,
        default: 'ERROR',
        enum: ['ERROR', 'NOTIFY', 'SUCCESS', 'LOG']
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

logSchema.virtual('id').get(function(){
    return this._id.toString();
});

logSchema.set('toJSON', {
    virtuals: true
});

logSchema.options.toJSON.transform = function (doc, ret, options) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('Log', logSchema);