import Account from './model';
import bcrypt from "bcryptjs";

export default {
	async writeAccount(data) {
		const account =  new Account(data);
		return account.save();
	},
	async getAccounts(g, query) {
		query.query.authGroup = g;
		return Account.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getAccount(authGroup, id) {
		return Account.findOne( { _id: id, authGroup });
	},
	async getAccountByAccess(authGroup, id, org) {
		const selectOptions = {
			authGroup: 1
		};
		if(org) {
			selectOptions.access = { $elemMatch: { 'organization.id': org } };
		}
		return Account.findOne( { _id: id, authGroup }).select(selectOptions);
	},
	async deleteAccount(authGroup, id) {
		return Account.findOneAndRemove( { _id: id, authGroup });
	},
	async patchAccount(authGroup, id, data, bpwd = false) {
		data.modifiedAt = Date.now();
		if(bpwd) {
			const salt = await bcrypt.genSalt(10);
			data.password = await bcrypt.hash(data.password, salt);
		}
		const options = { new: true, overwrite: true };
		if(data.organizations || data.orgDomains || data.access ) {
			options.runValidators = true;
		}
		return Account.findOneAndUpdate({ _id: id, authGroup }, data, options);
	},
	async getAccountByEmailOrUsername(authGroup, email, verifiedRequired = false) {
		const query = { authGroup, blocked: false, active: true, $or: [
			{ email },
			{ username: email }
		]};
		if(verifiedRequired === true) {
			query.verified = true;
		}
		return Account.findOne(query);
	},
	async updatePassword(authGroup, id, update) {
		if(update.password) {
			const salt = await bcrypt.genSalt(10);
			update.password = await bcrypt.hash(update.password, salt);
		}
		return Account.findOneAndUpdate({ _id: id, authGroup }, update, { new: true });
	},
	async checkOrganizations(authGroup, organizations) {
		return Account.find({ authGroup, organizations }).select({ _id: 1 });
	},
	async checkDomains(authGroup, orgDomains) {
		return Account.find({ authGroup, orgDomains }).select({ _id: 1 });
	}
};