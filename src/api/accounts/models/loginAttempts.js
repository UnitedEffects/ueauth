import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const loginAttempt = new mongoose.Schema({
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '1h'
    },
    authGroup: {
        type: String,
        required: true
    },
    accountId: {
        type: String,
        required: true
    },
    _id: {
        type: String,
        default: uuid
    }
},{ _id: false });

export default mongoose.model('login-attempt', loginAttempt);