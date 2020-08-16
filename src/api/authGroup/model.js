import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

mongoose.set('useCreateIndex', true);
const authGroup = new mongoose.Schema({
    createdAt: {
        type: Date,
        default: Date.now()
    },
    modifiedAt: {
        type: Date,
        default: Date.now()
    },
    securityExpiration: {
        type: Date,
        expires: 0
    },
    modifiedBy: {
        type: String,
        default: 'SYSTEM_ADMIN'
    },
    active: {
        type: Boolean,
        default: false
    },
    owner: {
        type: String,
        required: true
    },
    prettyName: {
        type: String,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    metadata: Object,
    config: Object,
    associatedClient: String, //todo <-- this isn't anything yet
    _id: {
        type: String,
        default: nanoid
    }
},{ _id: false });

// Execute before each user.save() call
authGroup.pre('save', function(next) {
    if(!this.prettyName) this.prettyName = this._id;
    next();
});

authGroup.virtual('id').get(function(){
    return this._id.toString();
});

authGroup.set('toJSON', {
    virtuals: true
});

authGroup.options.toJSON.transform = function (doc, ret, options) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.active;
    delete ret.owner;
    delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('auth_group', authGroup);