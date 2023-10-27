import Account from './models/accounts';
import History from './models/pHistory';
import Timeout from './models/loginTimeout';
import Attempt from './models/loginAttempts';
import bcrypt from 'bcryptjs';
import Organization from '../orgs/model';
import Domain from '../domains/model';
import Group from '../authGroup/model';

const config = require('../../config');

export default {
	async recordAttempt(authGroup, accountId) {
		const attempt = new Attempt({
			authGroup,
			accountId
		})
		return attempt.save();
	},
	async getAttempts(authGroup, accountId) {
		return Attempt.find({ authGroup, accountId }).countDocuments();
	},
	async clearAttempts(authGroup, accountId) {
		return Attempt.deleteMany({ authGroup, accountId });
	},
	async getTimeout(authGroup, accountId) {
		return Timeout.findOne({ authGroup, accountId });
	},
	async createTimeout(authGroup, accountId, expiresAt) {
		const timeout = new Timeout({
			authGroup,
			accountId,
			expiresAt
		});
		return timeout.save();
	},
	async clearTimeout(authGroup, accountId) {
		return Timeout.findOneAndRemove({ authGroup, accountId });
	},
	async getActiveAccountCount(authGroup) {
		return Account.find({ authGroup, active: true, blocked: { $ne: true } }).countDocuments();
	},
	async getActiveB2BCount(authGroup) {
		const query = { authGroup, active: true, blocked: { $ne: true }, $or: [
			{'access.0': { $exists: true } },
			{ 'mfa.enabled': true }
		] };
		return Account.find(query).countDocuments();
	},
	async writeAccount(data) {
		const account =  new Account(data);
		return account.save();
	},
	async writeMany(accounts) {
		return Account.insertMany(accounts, { ordered: false });
	},
	async savePasswordToHistory(authGroup, accountId, value) {
		const count = await this.getPasswordHistoryCount(authGroup, accountId);
		if(count >= config.MAX_PASSWORD_HISTORY_SAVED) {
			await this.removeOldestHistoryPassword(authGroup, accountId);
		}
		const history = new History({ authGroup, accountId, value });
		return history.save();
	},
	async isPreviousPassword(authGroup, accountId, password) {
		const passwords = await this.getPasswordHistory(authGroup, accountId);
		let found = false;
		for(let i = 0; i<passwords.length; i++) {
			if(!found) found = await passwords[i].verifyPassword(password);
			else break;
		}
		return found;
	},
	async getPasswordHistory(authGroup, accountId) {
		return History.find({ authGroup, accountId }).sort({ createdAt: -1 }).limit(config.MAX_PASSWORD_HISTORY_SAVED);
	},
	async getPasswordHistoryCount(authGroup, accountId) {
		return History.find({ authGroup, accountId }).countDocuments();
	},
	async removeOldestHistoryPassword(authGroup, accountId) {
		return History.findOneAndRemove({ authGroup, accountId }).sort({ createdAt: 1 });
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
			access: 1,
			email: 1
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
		return Account.findOneAndReplace({ _id: id, authGroup }, data, options);
	},
	async enableMFA(authGroup, id) {
		const update = {
			modifiedAt: Date.now(),
			modifiedBy: id,
			'mfa.enabled': true
		};
		return Account.findOneAndUpdate({ _id: id, authGroup }, update, { new: true });
	},
	async getAccountByEmailOrId(authGroup, data) {
		const query = {
			authGroup,
			blocked: false,
			active: true,
			verified: true,
			$or: [
				{ email: data },
				{ _id: data }
			]};
		return Account.findOne(query).select({ access: 0 });
	},
	async getAccountByEmailUsernameOrPhone(authGroup, data) {
		const query = {
			authGroup,
			blocked: false,
			active: true,
			verified: true,
			$or: [
				{ email: data },
				{ username: data },
				{ phone: data }
			]};
		return Account.findOne(query).select({ access: 0 });
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
	async userLockAccount(authGroup, _id, user) {
		if(!user) {
			return Account.findOneAndUpdate({ _id, authGroup }, { userLocked: true, 'mfa.enabled': false }, { new: true });
		} else {
			user.userLocked = true;
			user.mfa = {
				enabled: false
			};
			return user.save();
		}

	},
	async unlockAccount(authGroup, _id, email, password) {
		const update = {
			userLocked: false
		};
		const salt = await bcrypt.genSalt(10);
		update.password = await bcrypt.hash(password, salt);
		return Account.findOneAndUpdate({ _id, authGroup, email }, update, { new: true });
	},
	async checkOrganizations(authGroup, organizations) {
		return Account.find({ authGroup, access: { $elemMatch: { 'organization.id': organizations } } }).select({ _id: 1, authGroup: 1 });
	},
	async bulkAddUsersToDomains(authGroup, org, domains, ids) {
		const filter = {
			authGroup,
			_id: {$in: ids},
			access: { $elemMatch: {'organization.id': org} }
		};

		return Account.updateMany(filter, {
			$addToSet: {
				'access.$[o].organization.domains': { $each: domains }
			}}, {
			arrayFilters: [
				{ 'o.organization.id': org }
			],
			upsert: false
		});
	},
	async bulkRemoveUsersFromDomains(authGroup, org, domains, ids) {
		const filter = {
			authGroup,
			_id: {$in: ids},
			access: { $elemMatch: {'organization.id': org} }
		};

		return Account.updateMany(filter, {
			$pull: {
				'access.$[o].organization.domains': { $in: domains }
			}}, {
			arrayFilters: [
				{ 'o.organization.id': org }
			],
			upsert: false
		});
	},
	async bulkAddUsersToRoles(authGroup, org, roles, ids) {
		const filter = {
			authGroup,
			_id: {$in: ids},
			access: { $elemMatch: {'organization.id': org} }
		};

		return Account.updateMany(filter, {
			$addToSet: {
				'access.$[o].organization.roles': { $each: roles }
			}}, {
			arrayFilters: [
				{ 'o.organization.id': org }
			],
			upsert: false
		});
	},
	async bulkRemoveUsersFromRoles(authGroup, org, roles, ids) {
		const filter = {
			authGroup,
			_id: {$in: ids},
			access: { $elemMatch: {'organization.id': org} }
		};

		return Account.updateMany(filter, {
			$pull: {
				'access.$[o].organization.roles': { $in: roles }
			}}, {
			arrayFilters: [
				{ 'o.organization.id': org }
			],
			upsert: false
		});
	},
	async bulkAddUsersToOrg(authGroup, organization, ids) {
		const filter = {
			authGroup,
			_id: { $in: ids },
			access: {$not: { $elemMatch: { 'organization.id': organization.id }}}};
		if (organization.emailDomains?.length !== 0) {
			let emailFilter;
			organization.emailDomains.map((e) => {
				emailFilter = `^.*@${e.replace('.', '\\.')}|`;
				return e;
			});
			emailFilter = emailFilter.slice(0, -1);
			filter.email = new RegExp(emailFilter, 'i');
		}
		return Account.updateMany(filter, { $addToSet: {
			access: {
				organization: {
					id: organization.id,
					terms: {
						required: organization.access?.required || false,
						accepted: false,
						termsDeliveredOn: Date.now(),
						termsOfAccess: organization.access?.terms || undefined,
						termsVersion: organization.access?.termsVersion || undefined
					}
				}
			}
		}}, { upsert: false });
	},
	async bulkSetTermsAccessFalse(authGroup, org, newVersion, terms) {
		const filter = {
			authGroup,
			$and: [
				{access: { $elemMatch: {'organization.id': org }}},
				{access:  { $not: { 'organization.terms.termsVersion': newVersion }}},
			]
		};
		return Account.updateMany(filter, {
			'access.$[o].organization.terms.termsVersion': newVersion,
			'access.$[o].organization.terms.required': true,
			'access.$[o].organization.terms.termsDeliveredOn': Date.now(),
			'access.$[o].organization.terms.termsOfAccess': terms,
			'access.$[o].organization.terms.termsAcceptedOn': undefined,
			'access.$[o].organization.terms.accepted': false,
		}, {
			arrayFilters: [
				{ 'o.organization.id': org }
			],
			upsert: false
		});
	},
	async bulkRemoveUsersFromOrg(authGroup, org, ids) {
		return Account.updateMany({ authGroup, _id: { $in: ids }, access: { $elemMatch: { 'organization.id': org }}}, {
			$pull: {
				access: {
					$elemMatch: { 'organization.id': org }
				}
			}}, { upsert: false });
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
		return Account.aggregate([
			{
				$match: { _id:id, authGroup }
			},
			{
				$project: { access: 1 }
			},
			{
				$unwind: '$access'
			},
			{
				$replaceRoot: { newRoot: '$access.organization' }
			},
			{
				$lookup: {
					from: Organization.collection.name,
					let: { id: '$id' },
					pipeline: [
						{ $match: { $expr: { $eq: ['$_id', '$$id'] }}},
						{ $project: { name: 1, description: 1, access: 1, emailDomains: 1, restrictedEmailDomains: 1 }}
					],
					as: 'organization'
				}
			},
			{
				$unwind: '$organization'
			},
			{
				$unwind: {
					path: '$domains',
					preserveNullAndEmptyArrays: true
				}
			},
			{
				$lookup: {
					from: Domain.collection.name,
					let: { id: '$domains' },
					pipeline: [
						{ $match: { $expr: { $eq: ['$_id', '$$id'] }}},
						{ $project: { name: 1, description: 1 }}
					],
					as: 'domains'
				}
			},
			{
				$unwind: {
					path: '$domains',
					preserveNullAndEmptyArrays: true
				}
			},
			{
				$group: {
					_id: '$id',
					terms: { $first: '$terms' },
					domains: { $push: '$domains' },
					roles: { $first: '$roles' },
					organization: { $first: '$organization' },
				}
			},
			{
				$project: {
					_id: 0
				}
			}
		]);
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
		return Account.findOneAndUpdate({ _id, authGroup, userLocked: false }, { recoverCodes }, { new: true });
	},
	async getOwnerGroups(lookup) {
		return Account.aggregate([
			{
				$match: { $or: [{ email: lookup }, { 'phone.txt': lookup }]}
			},
			{
				$project: { authGroup: 1, _id: 1, email: 1 }
			},
			{
				$lookup: {
					from: Group.collection.name,
					let: { id: '$authGroup' },
					pipeline: [
						{ $match: { $expr: { $eq: ['$_id', '$$id'] }}},
						{ $project: { name: 1, prettyName: 1, owner: 1, aliasDnsUi: 1 }}
					],
					as: 'group'
				}
			},
			{
				$unwind: {
					path: '$group',
					preserveNullAndEmptyArrays: false
				}
			},
			{
				$project: { _id: 1, email: 1, group: 1 }
			},
		]);
	}
};