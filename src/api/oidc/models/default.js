import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import log from '../../logging/logs';

function dynamic(name) {
    const myModels = mongoose.modelNames();
    if (myModels.includes(name)) {
        return mongoose.models[name];
    }
    const defaultSchema = new mongoose.Schema({
        expiresAt: {
            type: Date,
            expires: 0
        },
        _id: {
            type: String,
            default: uuid
        },
        dynamic: {
            type: Boolean,
            default: true
        },
        payload: Object
    },{ _id: false, strict: false, collection: name });

    defaultSchema.pre('save', callback => {
        callback();
    });

    try {
        log.notify(`DYNAMIC MODEL CREATION - ${name}`);
        return mongoose.model(name, defaultSchema);
    } catch (error) {
        log.detail('ERROR','COULD NOT CREATE DEFAULT DYNAMIC MODEL', error);
        return error;
    }

}


export default dynamic;