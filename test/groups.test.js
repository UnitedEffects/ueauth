import '@babel/register';
import 'regenerator-runtime/runtime';
import { v4 as uuid } from 'uuid';
import Model from '../src/api/authGroup/model';
import ModelIAT from '../src/api/oidc/models/initialAccessToken';
import Plugins from '../src/api/plugins/model';
import iat from '../src/api/oidc/initialAccess/iat';
import dal from '../src/api/authGroup/dal';
import group from '../src/api/authGroup/group';
import { AccountMocks, GroupMocks, PluginMocks, Tokens } from './models';
import t from './testhelper';
import Group from "../src/api/authGroup/model";

const mockingoose = require('mockingoose');

describe('Auth Groups', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockingoose.resetAll();
		Model.Query.prototype.save.mockClear();
		Model.Query.prototype.findOne.mockClear();
		Model.Query.prototype.findOneAndUpdate.mockClear();
		ModelIAT.Query.prototype.save.mockClear();
		ModelIAT.Query.prototype.findOne.mockClear();
	});

	it('Create a group with default active as false and locked as false', async () => {
		try {
			const grp = GroupMocks.newGroup('TEST', 'tst', false, false);
			mockingoose(Model).toReturn(GroupMocks.group, 'findOne');
			const expected = JSON.parse(JSON.stringify(grp));
			expected.id = expected._id;
			delete expected._id;
			delete expected.active;
			delete expected.owner;
			delete expected.__v;
			mockingoose(Model).toReturn(grp, 'save');
			const data = {
				'name': grp.name,
				'prettyName': grp.prettyName,
				'owner': 'test@unitedeffects.com',
				'locked': false,
				'primaryDomain': 'unitedeffects.com',
				'primaryEmail': 'info@unitedeffects.com'
			};
			const spy = jest.spyOn(dal, 'write');
			const result = await group.write(data);
			expect(spy).toHaveBeenCalled();
			const calledDalWith = spy.mock.calls[0][0];
			expect(calledDalWith.securityExpiration).toBeDefined();
			expect(calledDalWith.primaryDomain).toBe('https://unitedeffects.com');
			expect(calledDalWith.active).toBe(false);
			expect(Model.prototype.save).toHaveBeenCalled();

			// lets simulate the mongoose constructor to validate our defaults
			const tempGroup = new Model(calledDalWith);
			expect(tempGroup.active).toBe(false);
			expect(tempGroup.owner).toBe('test@unitedeffects.com');
			expect(tempGroup.name).toBe(expected.name);
			expect(tempGroup.prettyName).toBe(expected.prettyName);
			expect(tempGroup.securityExpiration).toBe(calledDalWith.securityExpiration);
			expect(tempGroup.pluginOptions.notification.enabled).toBe(false);
			expect(tempGroup.config.centralPasswordReset).toBe(true);
			expect(tempGroup.config.requireVerified).toBe(false);
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});


	it('Create a group with active and passwordless as true - both should remain false', async () => {
		try {
			const grp = GroupMocks.newGroup('TEST', 'tst', true, false);
			mockingoose(Model).toReturn(GroupMocks.group, 'findOne');
			const expected = JSON.parse(JSON.stringify(grp));
			expected.id = expected._id;
			delete expected._id;
			delete expected.active;
			delete expected.owner;
			delete expected.__v;
			mockingoose(Model).toReturn(grp, 'save');
			const data = {
				'name': grp.name,
				'prettyName': grp.prettyName,
				'owner': 'test@unitedeffects.com',
				'locked': false,
				'primaryDomain': 'unitedeffects.com',
				'primaryEmail': 'info@unitedeffects.com',
				'config': {
					'passwordLessSupport': true
				}
			};
			const spy = jest.spyOn(dal, 'write');
			const result = await group.write(data);
			expect(spy).toHaveBeenCalled();
			const calledDalWith = spy.mock.calls[0][0];
			expect(calledDalWith.securityExpiration).toBeDefined();
			expect(calledDalWith.primaryDomain).toBe('https://unitedeffects.com');
			expect(calledDalWith.active).toBe(false);
			expect(calledDalWith.config.passwordLessSupport).toBe(false);
			expect(Model.prototype.save).toHaveBeenCalled();

			// lets simulate the mongoose constructor to validate our defaults
			const tempGroup = new Model(calledDalWith);
			expect(tempGroup.active).toBe(false);
			expect(tempGroup.owner).toBe('test@unitedeffects.com');
			expect(tempGroup.name).toBe(expected.name);
			expect(tempGroup.prettyName).toBe(expected.prettyName);
			expect(tempGroup.securityExpiration).toBe(calledDalWith.securityExpiration);
			expect(tempGroup.pluginOptions.notification.enabled).toBe(false);
			expect(tempGroup.config.centralPasswordReset).toBe(true);
			expect(tempGroup.config.requireVerified).toBe(false);
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('Create a group with active and requireVerified as true - both should remain false', async () => {
		try {
			const grp = GroupMocks.newGroup('TEST', 'tst', true, false);
			mockingoose(Model).toReturn(GroupMocks.group, 'findOne');
			const expected = JSON.parse(JSON.stringify(grp));
			expected.id = expected._id;
			delete expected._id;
			delete expected.active;
			delete expected.owner;
			delete expected.__v;
			mockingoose(Model).toReturn(grp, 'save');
			const data = {
				'name': grp.name,
				'prettyName': grp.prettyName,
				'owner': 'test@unitedeffects.com',
				'locked': false,
				'primaryDomain': 'unitedeffects.com',
				'primaryEmail': 'info@unitedeffects.com',
				'config': {
					'requireVerified': true
				}
			};
			const spy = jest.spyOn(dal, 'write');
			const result = await group.write(data);
			expect(spy).toHaveBeenCalled();
			const calledDalWith = spy.mock.calls[0][0];
			expect(calledDalWith.securityExpiration).toBeDefined();
			expect(calledDalWith.primaryDomain).toBe('https://unitedeffects.com');
			expect(calledDalWith.active).toBe(false);
			expect(calledDalWith.config.requireVerified).toBe(false);
			expect(Model.prototype.save).toHaveBeenCalled();

			// lets simulate the mongoose constructor to validate our defaults
			const tempGroup = new Model(calledDalWith);
			expect(tempGroup.active).toBe(false);
			expect(tempGroup.owner).toBe('test@unitedeffects.com');
			expect(tempGroup.name).toBe(expected.name);
			expect(tempGroup.prettyName).toBe(expected.prettyName);
			expect(tempGroup.securityExpiration).toBe(calledDalWith.securityExpiration);
			expect(tempGroup.pluginOptions.notification.enabled).toBe(false);
			expect(tempGroup.config.centralPasswordReset).toBe(true);
			expect(tempGroup.config.requireVerified).toBe(false);
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('complete group signup', async () => {
		try {
			const grp = GroupMocks.newGroup('TEST', 'tst', false, false);
			mockingoose(Model).toReturn(GroupMocks.group, 'findOne');
			const plugins = PluginMocks.global;
			const expected = JSON.parse(JSON.stringify(grp));
			expected.initialAccessToken = Tokens.iatPostMeta._id;
			expected.warning = 'Owner will not get a notification, global settings are not enabled';
			delete expected.config.keys;
			mockingoose(ModelIAT).toReturn(Tokens.iatPreMeta, 'save');
			mockingoose(ModelIAT).toReturn(Tokens.iatPostMeta, 'findOneAndUpdate');
			const spy = jest.spyOn(iat, 'generateIAT');
			const result = await group.completeGroupSignup(grp, plugins, 'test@unitedeffects.com');
			const args = spy.mock.calls[0];
			expect(args[0]).toBe(2678400);
			expect(args[1][0]).toBe('auth_group');
			expect(args[2]).toMatchObject(expected);
			expect(result).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('get group by id', async () => {
		try {
			const grp = GroupMocks.newGroup('TEST', 'tst', false, false);
			const expected = JSON.parse(JSON.stringify(grp));
			expected.id = expected._id;
			delete expected._id;
			delete expected.active;
			delete expected.owner;
			delete expected.__v;
			mockingoose(Model).toReturn(grp, 'findOne');
			const result = await group.getOneByEither(grp._id, false);
			const query = {
				$or: [
					{ _id: grp._id },
					{ prettyName: grp._id }
				]
			};
			expect(Model.Query.prototype.findOne).toHaveBeenCalledWith(query, undefined);
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('get group by prettyName', async () => {
		try {
			const grp = GroupMocks.newGroup('TEST', 'tst', false, false);
			const expected = JSON.parse(JSON.stringify(grp));
			expected.id = expected._id;
			delete expected._id;
			delete expected.active;
			delete expected.owner;
			delete expected.__v;
			mockingoose(Model).toReturn(grp, 'findOne');
			const result = await group.getOneByEither(grp.prettyName, false);
			const query = {
				$or: [
					{ _id: grp.prettyName },
					{ prettyName: grp.prettyName }
				]
			};
			expect(Model.Query.prototype.findOne).toHaveBeenCalledWith(query, undefined);
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('switch group owner', async () => {
		try {
			const grp = GroupMocks.newGroup('TEST', 'tst', false, false);
			mockingoose(Model).toReturn(GroupMocks.group, 'findOne');
			const updated = JSON.parse(JSON.stringify(grp));
			updated.owner = uuid();
			const expected = JSON.parse(JSON.stringify(updated));
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');
			expected.id = expected._id;
			delete expected._id;
			delete expected.active;
			delete expected.owner;
			delete expected.__v;
			const result = await group.switchGroupOwner(grp, updated.owner);
			expect(Model.Query.prototype.findOneAndUpdate).toHaveBeenCalledWith({ _id: grp._id }, { owner: updated.owner }, { new: true}, undefined);
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('activate a new authgroup', async () => {
		try {
			const grp = GroupMocks.newGroup('NewGroup', 'ngt', false, false, true);
			mockingoose(Model).toReturn(GroupMocks.group, 'findOne');
			const act = AccountMocks.randomAccount();
			const clientId = uuid();
			const updated = JSON.parse(JSON.stringify(grp));
			delete updated.securityExpiration;
			updated.owner = act._id;
			updated.modifiedBy = act._id;
			updated.active = true;
			updated.associatedClient = clientId;
			const expected = JSON.parse(JSON.stringify(updated));
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');
			expected.id = expected._id;
			delete expected._id;
			delete expected.active;
			delete expected.owner;
			delete expected.__v;
			const spy = jest.spyOn(dal, 'activatePatch');
			const result = await group.activateNewAuthGroup(grp, act, clientId);
			const args = spy.mock.calls[0];
			expect(args[0]).toBe(grp.id || grp._id);
			delete updated.modifiedAt; //not important for this
			expect(args[1]).toMatchObject(expect.objectContaining(updated));
			expect(Model.Query.prototype.findOneAndUpdate).toHaveBeenCalled();
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('rotate auth group oidc keys', async () => {
		try {
			const grp = GroupMocks.newGroup('NewGroup', 'ngt', true, false );
			mockingoose(Model).toReturn(GroupMocks.group, 'findOne');
			const act = AccountMocks.randomAccount();
			mockingoose(Model).toReturn(grp, 'findOneAndUpdate');
			const spy = jest.spyOn(dal, 'patchNoOverwrite');
			const result = await group.operations(grp._id, 'rotate_keys', { sub: act._id });
			const args = spy.mock.calls[0];
			expect(args[0]).toBe(grp.id || grp._id);
			expect(args[1]).toMatchObject(expect.objectContaining({ modifiedBy: act._id }));
			const newKeys = args[1]['config.keys'];
			expect( Array.isArray(newKeys)).toBe(true);
			expect(newKeys.length).toBe(5);
			expect(Model.Query.prototype.findOneAndUpdate).toHaveBeenCalled();
		} catch (error) {
			t.fail(error);
		}
	});

	it('patch a group with name change', async () => {
		try {

			const grp = GroupMocks.newGroup('TEST ONE', 'tst1', true, false);
			mockingoose(Model).toReturn(GroupMocks.group, 'findOne');
			const user = uuid();
			const updated = JSON.parse(JSON.stringify(grp));
			updated.name = 'UPDATED TEST';
			updated.modifiedBy = user;
			const expected = JSON.parse(JSON.stringify(updated));
			expected.id = expected._id;
			delete expected._id;
			delete expected.active;
			delete expected.owner;
			delete expected.__v;
			grp.toObject = jest.fn(()=>{
				return grp;
			});
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');

			// ignoring these since they are dynamic
			delete updated.createdAt;
			delete updated.modifiedAt;

			const data = [
				{
					'op':'replace',
					'path':'/name',
					'value': updated.name
				}
			];
			const result = await group.patch(grp, data, user);
			//const result = await account.patchAccount(oneGroup, oneAccount._id, update, oneAccount._id, false);
			expect(Model.Query.prototype.findOneAndUpdate).toHaveBeenCalledWith({ _id: grp._id, active: true }, expect.objectContaining(updated), { 'new': true, 'overwrite': true}, undefined);
			const res = JSON.parse(JSON.stringify(result));

			// ignoring these since they are dynamic - we do this by just setting to the actual result so check passes
			expected.createdAt = res.createdAt;
			expected.modifiedAt = res.modifiedAt;

			//check final expected result
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('patch a group with notification to true while global is true', async () => {
		try {
			const global = PluginMocks.notification(true);
			const grp = GroupMocks.newGroup('TEST ONE', 'tst1', true, false);
			mockingoose(Model).toReturn(GroupMocks.group, 'findOne');
			grp.pluginOptions.notification.enabled = false;
			const user = uuid();
			const updated = JSON.parse(JSON.stringify(grp));
			updated.pluginOptions.notification.enabled = true;
			updated.modifiedBy = user;
			const expected = JSON.parse(JSON.stringify(updated));
			expected.id = expected._id;
			delete expected._id;
			delete expected.active;
			delete expected.owner;
			delete expected.__v;
			grp.toObject = jest.fn(()=>{
				return grp;
			});
			mockingoose(Plugins).toReturn(global, 'findOne');
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');

			// ignoring these since they are dynamic
			delete updated.createdAt;
			delete updated.modifiedAt;

			const data = [
				{
					'op':'replace',
					'path':'/pluginOptions/notification/enabled',
					'value': true
				}
			];
			const result = await group.patch(grp, data, user);
			//const result = await account.patchAccount(oneGroup, oneAccount._id, update, oneAccount._id, false);
			expect(Model.Query.prototype.findOneAndUpdate).toHaveBeenCalledWith({ _id: grp._id, active: true }, expect.objectContaining(updated), { 'new': true, 'overwrite': true}, undefined);
			const res = JSON.parse(JSON.stringify(result));

			// ignoring these since they are dynamic - we do this by just setting to the actual result so check passes
			expected.createdAt = res.createdAt;
			expected.modifiedAt = res.modifiedAt;

			//check final expected result
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('patch a group with notification to true while global is false', async () => {
		try {
			const global = PluginMocks.notification(false);
			const grp = GroupMocks.newGroup('TEST ONE', 'tst1', true, false);
			mockingoose(Model).toReturn(GroupMocks.group, 'findOne');
			grp.pluginOptions.notification.enabled = false;
			const user = uuid();
			const updated = JSON.parse(JSON.stringify(grp));
			updated.pluginOptions.notification.enabled = true;
			updated.modifiedBy = user;
			const expected = JSON.parse(JSON.stringify(updated));
			expected.id = expected._id;
			delete expected._id;
			delete expected.active;
			delete expected.owner;
			delete expected.__v;
			grp.toObject = jest.fn(()=>{
				return grp;
			});
			mockingoose(Plugins).toReturn(global, 'findOne');
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');

			// ignoring these since they are dynamic
			delete updated.createdAt;
			delete updated.modifiedAt;

			const data = [
				{
					'op':'replace',
					'path':'/pluginOptions/notification/enabled',
					'value': true
				}
			];
			const result = await group.patch(grp, data, user);
			expect(result).toBe(undefined);
			t.fail();
		} catch (error) {
			expect(error.isBoom).toBe(true);
			expect(error.output.statusCode).toBe(405);
			expect(error.output.payload.error).toBe('Method Not Allowed');
			expect(error.output.payload.message).toBe('The Service Admin has not enabled Global Notifications. This options is not currently possible for Auth Groups. Contact your admin to activate this feature.');
		}
	});

	it('patch a group with passwordless to true while global is true but group notification is false', async () => {
		try {
			const global = PluginMocks.notification(true);
			const grp = GroupMocks.newGroup('TEST ONE', 'tst1', true, false);
			mockingoose(Model).toReturn(GroupMocks.group, 'findOne');
			grp.pluginOptions.notification.enabled = false;
			const user = uuid();
			const updated = JSON.parse(JSON.stringify(grp));
			updated.config.passwordLessSupport = true;
			updated.modifiedBy = user;
			const expected = JSON.parse(JSON.stringify(updated));
			expected.id = expected._id;
			delete expected._id;
			delete expected.active;
			delete expected.owner;
			delete expected.__v;
			grp.toObject = jest.fn(()=>{
				return grp;
			});
			mockingoose(Plugins).toReturn(global, 'findOne');
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');

			// ignoring these since they are dynamic
			delete updated.createdAt;
			delete updated.modifiedAt;

			const data = [
				{
					'op':'replace',
					'path':'/config/passwordLessSupport',
					'value': true
				}
			];
			const result = await group.patch(grp, data, user);
			expect(result).toBe(undefined);
			t.fail();
		} catch (error) {
			expect(error.isBoom).toBe(true);
			expect(error.output.statusCode).toBe(405);
			expect(error.output.payload.error).toBe('Method Not Allowed');
		}
	});

	it('patch a group with passwordless to true while global is false', async () => {
		try {
			const global = PluginMocks.notification(false);
			const grp = GroupMocks.newGroup('TEST ONE', 'tst1', true, false);
			mockingoose(Model).toReturn(GroupMocks.group, 'findOne');
			grp.pluginOptions.notification.enabled = false;
			const user = uuid();
			const updated = JSON.parse(JSON.stringify(grp));
			updated.config.passwordLessSupport = true;
			updated.modifiedBy = user;
			const expected = JSON.parse(JSON.stringify(updated));
			expected.id = expected._id;
			delete expected._id;
			delete expected.active;
			delete expected.owner;
			delete expected.__v;
			grp.toObject = jest.fn(()=>{
				return grp;
			});
			mockingoose(Plugins).toReturn(global, 'findOne');
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');

			// ignoring these since they are dynamic
			delete updated.createdAt;
			delete updated.modifiedAt;

			const data = [
				{
					'op':'replace',
					'path':'/config/passwordLessSupport',
					'value': true
				}
			];
			const result = await group.patch(grp, data, user);
			expect(result).toBe(undefined);
			t.fail();
		} catch (error) {
			expect(error.isBoom).toBe(true);
			expect(error.output.statusCode).toBe(405);
			expect(error.output.payload.error).toBe('Method Not Allowed');
		}
	});

	it('patch a group with requireVerify to true while group notification is false', async () => {
		try {
			const global = PluginMocks.notification(true);
			const grp = GroupMocks.newGroup('TEST ONE', 'tst1', true, false);
			mockingoose(Model).toReturn(GroupMocks.group, 'findOne');
			grp.pluginOptions.notification.enabled = false;
			const user = uuid();
			const updated = JSON.parse(JSON.stringify(grp));
			updated.config.requireVerified = true;
			updated.modifiedBy = user;
			const expected = JSON.parse(JSON.stringify(updated));
			expected.id = expected._id;
			delete expected._id;
			delete expected.active;
			delete expected.owner;
			delete expected.__v;
			grp.toObject = jest.fn(()=>{
				return grp;
			});
			mockingoose(Plugins).toReturn(global, 'findOne');
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');

			// ignoring these since they are dynamic
			delete updated.createdAt;
			delete updated.modifiedAt;

			const data = [
				{
					'op':'replace',
					'path':'/config/requireVerified',
					'value': true
				}
			];
			const result = await group.patch(grp, data, user);
			expect(result).toBe(undefined);
			t.fail();
		} catch (error) {
			expect(error.isBoom).toBe(true);
			expect(error.output.statusCode).toBe(405);
			expect(error.output.payload.error).toBe('Method Not Allowed');
		}
	});
});