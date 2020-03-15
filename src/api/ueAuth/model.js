import mongoose from 'mongoose';
mongoose.Promise = Promise;
import bcrypt from 'bcryptjs';

mongoose.set('useCreateIndex', true);
const ueTokenSchema = new mongoose.Schema({
    value: {
        type: String,
        required: true
    },
    user_id: {
        type: String,
        required: true,
        index: true
    },
    product_slug:{
        type: String,
        required: true
    },
    domain_slug: {
        type: String,
        required: true
    },
    user: {
        type: Object,
        required: true
    },
    created: {
        type: Date,
        required: true,
        expires: '12h'
    }
});

// Execute before each user.save() call
ueTokenSchema.pre('save', function(callback) {
    const token = this;

    // Break out if the password hasn't changed
    if (!token.isModified('value')) return callback();

    // Password changed so we need to hash it
    bcrypt.genSalt(5, (err, salt) => {
        if (err) return callback(err);

        bcrypt.hash(token.value, salt, null, (err, hash) => {
            if (err) return callback(err);
            token.value = hash;
            callback();
        });
    });
});

ueTokenSchema.methods.verifyTokenAsync = function(token) {
    return new Promise((resolve, reject) => {
        bcrypt.compare(token, this.value, (err, isMatch) => {
            if (err) return reject(err);
            return resolve(isMatch)
        });
    })
};

// Export the Mongoose model
export default mongoose.model('ueAuthToken', ueTokenSchema);