import mongoose from 'mongoose';
import { uuid } from 'uuidv4';
import bcrypt from 'bcryptjs';

mongoose.set('useCreateIndex', true);

const accountSchema = new mongoose.Schema({
    createdAt: {
        type: Date,
        default: Date.now()
    },
    modifiedAt: {
        type: Date,
        default: Date.now()
    },
    email: {
        type: String,
        unique: true, // todo ultimately, this should only be unique within a user group
        required: true
    },
    /**
     * todo create a tenant model with userGroups
     * userGroup: {
     *  type: String,
     *  required: true
     * }
     */
    password: {
        type: String,
        required: true
    },
    txt: String, //todo format phone number?
    verified: {
        type: Boolean,
        default: false
    },
    _id: {
        type: String,
        default: uuid
    }
},{ _id: false });


accountSchema.pre('save', function(callback) {
    const account = this;

    if (!account.isModified('password')) return callback();

    // Password changed so we need to hash it
    bcrypt.genSalt(10, (err, salt) => {
        if (err) return callback(err);

        bcrypt.hash(account.password, salt, (err, hash) => {
            if (err) return callback(err);
            account.password = hash;
            callback();
        });
    });
});

accountSchema.methods.verifyPassword = function(password) {
    return new Promise((resolve, reject) => {
        bcrypt.compare(password, this.password, (err, isMatch) => {
            if (err) return reject(err);
            return resolve(isMatch)
        });
    })
};

accountSchema.virtual('id').get(function(){
    return this._id.toString();
});

accountSchema.set('toJSON', {
    virtuals: true
});

accountSchema.options.toJSON.transform = function (doc, ret, options) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.password;
    delete ret.__v;
};

// Export the Mongoose model
export default mongoose.model('accounts', accountSchema);