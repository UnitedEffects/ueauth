import Account from './model';
import bcrypt from 'bcryptjs';

export default {
	async writeAccount(data) {
		const account =  new Account(data);
		return account.save();
	},
	async getAccounts(g, query) {
		query.query.authGroup = g;
		return Account.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getAccountsByOrg(g, o, query) {
		query.query.authGroup = g;
		query.query.access = { $elemMatch: { 'organization.id': o } };
		if(query.query.domains) {
			query.query.access.$elemMatch['organization.domains'] = query.query.domains;
			delete query.query.domains;
		}
		return Account.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
	},
	async getAccount(authGroup, id) {
		return Account.findOne( { _id: id, authGroup });
	},
	async getFederatedAccount(authGroup, provider, federatedId) {
		return Account.findOne({ authGroup, 'identities.provider': provider, 'identities.id': federatedId });
	},
	async getAccountByOrg(authGroup, org, id) {
		const query = {
			_id: id,
			authGroup,
			access: { $elemMatch: { 'organization.id': org } }
		};
		return Account.findOne(query);
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
	async enableMFA(authGroup, id) {
		const update = {
			modifiedAt: Date.now(),
			modifiedBy: id,
			'mfa.enabled': true
		};
		return Account.findOneAndUpdate({ _id: id, authGroup }, update, { new: true });
	},
	async getAccountByEmailOrUsername(authGroup, email, verifiedRequired = false, hideAccess = true) {
		const query = { authGroup, blocked: false, active: true, $or: [
			{ email },
			{ username: email }
		]};
		if(verifiedRequired === true) {
			query.verified = true;
		}
		const select = (hideAccess) ? { access: 0 } : {};
		return Account.findOne(query).select(select);
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
	},
	async searchAccounts(authGroup, q) {
		return Account.find({
			authGroup,
			$text : { $search : q }
		}).select({ _id: 1, email: 1, username: 1});
	},
	async getAllOrgs(authGroup, id) {
		let output = {
			id,
			authGroup,
			access: []
		};
		const result = await Account.findOne({ _id:id, authGroup }).select({ access: 1 });
		if(result && result.access.length !== 0) {
			result.access.map((org) => {
				output.access.push(org);
			});
		}
		return output;
	},
	async checkOneUserOrganizations(authGroup, organizations, id) {
		return Account.findOne({ _id: id, authGroup, access: { $elemMatch: { 'organization.id': organizations } } }).select({ _id: 1, authGroup: 1 });
	},
	async setRecoveryCodes(authGroup, _id, codes) {
		let recoverCodes = [];
		await Promise.all(codes.map(async (code) => {
			recoverCodes.push(await bcrypt.hash(code, await bcrypt.genSalt(10)));
			return code;
		}));
		return Account.findOneAndUpdate({ _id, authGroup }, { recoverCodes }, { new: true });
	}
};