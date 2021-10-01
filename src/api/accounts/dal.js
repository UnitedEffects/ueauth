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
			authGroup: 1,
			access: 1
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
		return Account.findOne(query).select({ access: 0 });
	},
	async updatePassword(authGroup, id, update) {
		if(update.password) {
			const salt = await bcrypt.genSalt(10);
			update.password = await bcrypt.hash(update.password, salt);
		}
		return Account.findOneAndUpdate({ _id: id, authGroup }, update, { new: true });
	},
	async checkOrganizations(authGroup, organizations) {
		return Account.find({ authGroup, access: { $elemMatch: { 'organization.id': organizations } } }).select({ _id: 1, authGroup: 1 });
	},
	async checkDomains(authGroup, orgId, id) {
		return Account.find({ authGroup, access: { $elemMatch: { 'organization.id': orgId, 'organization.domains': id }} }).select({ _id: 1, authGroup: 1 });
	},
	async checkRoles(authGroup, id) {
		const accounts = await Account.find({ authGroup, access: { $elemMatch: { 'organization.roles': id }} }).select({ _id: 1, authGroup: 1, access : { $elemMatch: { 'organization.roles': id }}});
		const output = [];
		accounts.map((ac) => {
			const temp = {
				id: ac.id,
				authGroup: ac.authGroup,
				organizationsWhereApplied: []
			};
			ac.access.map((o) => {
				temp.organizationsWhereApplied.push(o.organization.id);
			});
			output.push(temp);
		});
		return output;
	}
};