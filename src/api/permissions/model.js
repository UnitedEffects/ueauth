import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
mongoose.set('useCreateIndex', true);

const permissionSchema = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now()
	},
	createdBy: {
		type: String,
		default: 'SYSTEM_ADMIN'
	},
	authGroup: {
		type: String,
		required: true
	},
	description: String,
	ownershipRequired: {
		type: Boolean,
		default: false
	},
	product: {
		type: String,
		required: true
	},
	target: {
		type: String,
		required: true
	},
	action: {
		type: String,
		required: true
	},
	coded: {
		type: String
	},
	// indicates if this is a protected resource created as part of initialization
	core: {
		type: Boolean,
		default: false
	},
	tags: [String],
	_id: {
		type: String,
		default: uuid
	}
},{ _id: false });

permissionSchema.index({ coded: 1, authGroup: 1, product: 1}, { unique: true });
permissionSchema.index( { target: 'text', action: 'text', description: 'text', tags: 'text' });

permissionSchema.pre('save', function(callback) {
	const permission = this;
	permission.coded = (permission.ownershipRequired === true) ?
		`${permission.target.toLowerCase().replace(/ /g, '-')}::${permission.action.toLowerCase().replace(/ /g, '-')}:own` :
		`${permission.target.toLowerCase().replace(/ /g, '-')}::${permission.action.toLowerCase().replace(/ /g, '-')}`;
	callback();
});

permissionSchema.pre('insertMany', function(callback, docs) {
	if(Array.isArray(docs)) {
		docs.map((permission) => {
			permission.coded = (permission.ownershipRequired === true) ?
				`${permission.target.toLowerCase().replace(/ /g, '-')}::${permission.action.toLowerCase().replace(/ /g, '-')}:own` :
				`${permission.target.toLowerCase().replace(/ /g, '-')}::${permission.action.toLowerCase().replace(/ /g, '-')}`;
		});
	}
	callback();
});

permissionSchema.virtual('id').get(function(){
	return this._id.toString();
});

permissionSchema.set('toJSON', {
	virtuals: true
});

permissionSchema.options.toJSON.transform = function (doc, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
	//delete ret.core;
};

// Export the Mongoose model
export default mongoose.model('permissions', permissionSchema);