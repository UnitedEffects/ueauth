import '@babel/register';
import 'regenerator-runtime/runtime';
import Model from '../src/api/invites/model';
import dal from '../src/api/invites/dal';
import invite from '../src/api/invites/invites';
import { GroupMocks, InviteMocks } from './models';

// mocks for Group
import ModelG from '../src/api/authGroup/model';

import t from './testhelper';

const mockingoose = require('mockingoose');

describe('Invites', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockingoose.resetAll();
		Model.Query.prototype.save.mockClear();
		Model.Query.prototype.findOne.mockClear();
		Model.Query.prototype.findOneAndUpdate.mockClear();
		ModelG.Query.prototype.findOne.mockClear();
	});

	it('Create an invite for valid resource - group', async () => {
		try {
			const inv = InviteMocks.newInvite();
			const grp = GroupMocks.newGroup('Test', 'tst', true, true);
			const group = JSON.parse(JSON.stringify(grp));
			group._id = inv.authGroup;
			const expected = JSON.parse(JSON.stringify(inv));
			expected.id = expected._id;
			delete expected._id;
			delete expected.__v;
			mockingoose(Model).toReturn(inv, 'save');
			mockingoose(ModelG).toReturn(grp, 'findOne');
			const data = {
				'daysToExpire': 20,
				'type': inv.type,
				'sub': inv.sub,
				'resources': [
					{
						'resourceType': inv.resources[0].resourceType,
						'resourceId': inv.resources[0].resourceId
					}
				]
			};
			const spy = jest.spyOn(dal, 'createInvite');
			const result = await invite.createInvite(inv.sub, data, group);
			expect(spy).toHaveBeenCalled();
			const calledDalWith = spy.mock.calls[0][0];
			expect(calledDalWith.authGroup).toBe(group._id);
			expect(Model.prototype.save).toHaveBeenCalled();
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(expected);
			// validate status is new when first created by default
			const tempInvite = new Model(calledDalWith);
			expect(tempInvite.status).toBe('new');
			expect(tempInvite.xSent).toBe(0);
		} catch (error) {
			t.fail(error);
		}
	});

	it('Create an invite for invalid resource - group', async () => {
		try {
			const inv = InviteMocks.newInvite();
			const grp = GroupMocks.newGroup('Test', 'tst', true, true);
			const group = JSON.parse(JSON.stringify(grp));
			group._id = inv.authGroup;
			const expected = JSON.parse(JSON.stringify(inv));
			expected.id = expected._id;
			delete expected._id;
			delete expected.__v;
			mockingoose(Model).toReturn(inv, 'save');
			mockingoose(ModelG).toReturn(undefined, 'findOne');
			const data = {
				'daysToExpire': 20,
				'type': inv.type,
				'sub': inv.sub,
				'resources': [
					{
						'resourceType': inv.resources[0].resourceType,
						'resourceId': inv.resources[0].resourceId
					}
				]
			};
			await invite.createInvite(inv.sub, data, group);
			t.fail();
		} catch (error) {
			expect(error.output.statusCode).toBe(400);
			expect(error.output.payload.error).toBe('Bad Request');
		}
	});

	it('get invite by id', async () => {
		try {
			const inv = InviteMocks.newInvite();
			const grp = GroupMocks.newGroup('Test', 'tst', true, true);
			const group = JSON.parse(JSON.stringify(grp));
			group._id = inv.authGroup;
			const expected = JSON.parse(JSON.stringify(inv));
			expected.id = expected._id;
			delete expected._id;
			delete expected.__v;
			mockingoose(Model).toReturn(inv, 'findOne');
			const result = await invite.getInvite(inv.authGroup, inv._id);
			expect(Model.Query.prototype.findOne).toHaveBeenCalledWith({ _id: inv._id, authGroup: inv.authGroup }, undefined);
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('authorized lookup - get invite by sub, type and authgroup', async () => {
		try {
			const inv = InviteMocks.newInvite();
			const grp = GroupMocks.newGroup('Test', 'tst', true, true);
			const group = JSON.parse(JSON.stringify(grp));
			group._id = inv.authGroup;
			const expected = JSON.parse(JSON.stringify(inv));
			expected.id = expected._id;
			delete expected._id;
			delete expected.__v;
			mockingoose(Model).toReturn(inv, 'findOne');
			const result = await invite.inviteAuthorizedLookup(inv.authGroup, inv.sub, inv.type);
			expect(Model.Query.prototype.findOne).toHaveBeenCalledWith({ sub: inv.sub, authGroup: inv.authGroup, type: inv.type }, undefined);
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('increment sent counter', async () => {
		try {
			const inv = InviteMocks.newInvite();
			const grp = GroupMocks.newGroup('Test', 'tst', true, true);
			const group = JSON.parse(JSON.stringify(grp));
			group._id = inv.authGroup;
			const updated = JSON.parse(JSON.stringify(inv));
			updated.status = 'sent';
			updated.xSent = updated.xSent + 1;
			const expected = JSON.parse(JSON.stringify(updated));
			expected.id = expected._id;
			delete expected._id;
			delete expected.__v;
			const update = {
				status: 'sent',
				$inc : { xSent : 1 }
			};
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');
			const result = await invite.incSent(inv.authGroup, inv._id);
			expect(Model.Query.prototype.findOneAndUpdate).toHaveBeenCalledWith({ _id: inv._id, authGroup: inv.authGroup }, update, { new: true}, undefined);
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('update status', async () => {
		try {
			const inv = InviteMocks.newInvite();
			const grp = GroupMocks.newGroup('Test', 'tst', true, true);
			const group = JSON.parse(JSON.stringify(grp));
			group._id = inv.authGroup;
			const updated = JSON.parse(JSON.stringify(inv));
			updated.status = 'accepted';
			const expected = JSON.parse(JSON.stringify(updated));
			expected.id = expected._id;
			delete expected._id;
			delete expected.__v;
			const update = {
				status: 'accepted'
			};
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');
			const result = await invite.updateInviteStatus(inv.authGroup, inv._id, 'accepted');
			expect(Model.Query.prototype.findOneAndUpdate).toHaveBeenCalledWith({ _id: inv._id, authGroup: inv.authGroup }, update, { new: true}, undefined);
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});
});