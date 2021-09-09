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
	async deleteAccount(authGroup, id) {
		return Account.findOneAndRemove( { _id: id, authGroup });
	},
	async patchAccount(authGroup, id, data, bpwd = false) {
		data.modifiedAt = Date.now();
		if(bpwd) {
			const salt = await bcrypt.genSalt(10);
			data.password = await bcrypt.hash(data.password, salt);
		}
		return Account.findOneAndUpdate({ _id: id, authGroup }, data, { new: true, overwrite: true });
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
	}
};