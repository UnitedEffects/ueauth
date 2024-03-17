import '@babel/register';
import 'regenerator-runtime/runtime';
import Model from '../src/api/plugins/notifications/model';
import Group from '../src/api/authGroup/model';
import notify from '../src/api/plugins/notifications/notifications';
import {GroupMocks, PluginMocks, NotifyMocks, Tokens} from './models';

// mocks for Group
import ModelG from '../src/api/authGroup/model';
import t from './testhelper';

// mocks for plugins
import ModelP from '../src/api/plugins/model';

// Clients
import ModelC from '../src/api/oidc/models/client';
import cl from '../src/api/oidc/client/clients';
jest.mock('../src/api/oidc/client/clients');

// Axios
import axios from 'axios';
jest.mock('axios');

const mockingoose = require('mockingoose');

describe('Plugins', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockingoose.resetAll();
		Model.Query.prototype.save.mockClear();
		Model.Query.prototype.findOne.mockClear();
		Model.Query.prototype.findOneAndUpdate.mockClear();
		ModelG.Query.prototype.findOne.mockClear();
		ModelP.Query.prototype.findOne.mockClear();
		ModelC.Query.prototype.findOne.mockClear();
		mockingoose(Group).toReturn(GroupMocks.group, 'findOne');
	});

	it('Create Notification', async () => {
		try {
			const not = NotifyMocks.newNotification();
			const expected = JSON.parse(JSON.stringify(not));
			expected.id = expected._id;
			delete expected.__v;
			delete expected._id;
			delete expected.createdAt; //not needed for final validation
			mockingoose(Model).toReturn(not, 'save');
			const data = {
				destinationUri: not.destinationUri,
				authGroupId: not.authGroupId,
				createdBy: not.createdBy
			};
			const result = await notify.createNotification(data);
			const res = JSON.parse(JSON.stringify(result));
			expect(Model.prototype.save).toHaveBeenCalled();
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('Validate defaults for new notification', async () => {
		try {
			const not = NotifyMocks.newNotification();
			const data = {
				destinationUri: not.destinationUri,
				authGroupId: not.authGroupId,
				createdBy: not.createdBy
			};
			const result = new Model(data);
			expect(result.processed).toBe(false);
			expect(result._id).toBeDefined();
			expect(result.createdAt).toBeDefined();
		} catch (error) {
			t.fail(error);
		}
	});

	it('Send Notification with token', async () => {
		try {
			const not = NotifyMocks.newNotification();
			const updated = JSON.parse(JSON.stringify(not));
			updated.processed = true;
			const payload = JSON.parse(JSON.stringify(not));
			delete payload.processed;
			const global = PluginMocks.notification(true);
			const tok = Tokens.iatPostMeta;
			const token = {
				data: {
					access_token: tok._id
				}
			};
			axios.mockResolvedValue({ data: not });
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');
			const result = await notify.sendNotification(not, global, token);
			const expectedOptions = {
				method: 'POST',
				headers: {
					'Authorization': `bearer ${token.data.access_token}`
				},
				data: payload,
				url: not.destinationUri
			};
			expect(axios).toHaveBeenCalled();
			const args = axios.mock.calls[0];
			expect(args[0]).toMatchObject(expectedOptions);
			expect(Model.Query.prototype.findOneAndUpdate).toHaveBeenCalledWith({ _id: not._id }, { processed: true }, { new: true});
			const res = JSON.parse(JSON.stringify(result.data));
			expect(res._id).toBe(updated._id);
		} catch (error) {
			t.fail(error);
		}
	});

	it('Send Notification without token or global', async () => {
		try {
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			const client = PluginMocks.notificationClient();
			const not = NotifyMocks.newNotification();
			const updated = JSON.parse(JSON.stringify(not));
			updated.processed = true;
			const payload = JSON.parse(JSON.stringify(not));
			delete payload.processed;
			const global = PluginMocks.notification(true);
			const tok = Tokens.iatPostMeta;
			const token = {
				data: {
					access_token: tok._id
				}
			};
			axios.mockResolvedValue({ data: not });
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');
			mockingoose(ModelG).toReturn(grp, 'findOne');
			mockingoose(ModelC).toReturn(client, 'findOne');
			mockingoose(ModelP).toReturn(global, 'findOne');
			cl.generateClientCredentialToken.mockResolvedValue(token);
			const result = await notify.sendNotification(not, null, null);
			const expectedOptions = {
				method: 'POST',
				headers: {
					'Authorization': `bearer ${token.data.access_token}`
				},
				data: payload,
				url: not.destinationUri
			};
			expect(ModelG.Query.prototype.findOne).toHaveBeenCalled();
			expect(ModelC.Query.prototype.findOne).toHaveBeenCalled();
			expect(ModelP.Query.prototype.findOne).toHaveBeenCalled();
			expect(cl.generateClientCredentialToken).toHaveBeenCalled();
			const clGenArgs = cl.generateClientCredentialToken.mock.calls[0];
			expect(clGenArgs[2]).toBe(`api:write group:${grp._id}`);
			expect(axios).toHaveBeenCalled();
			const args = axios.mock.calls[0];
			expect(args[0]).toMatchObject(expectedOptions);
			expect(Model.Query.prototype.findOneAndUpdate).toHaveBeenCalledWith({ _id: not._id }, { processed: true }, { new: true});
			const res = JSON.parse(JSON.stringify(result.data));
			expect(res._id).toBe(updated._id);
		} catch (error) {
			t.fail(error);
		}
	});

	it('Send Notification without token', async () => {
		try {
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			const client = PluginMocks.notificationClient();
			const not = NotifyMocks.newNotification();
			const updated = JSON.parse(JSON.stringify(not));
			updated.processed = true;
			const payload = JSON.parse(JSON.stringify(not));
			delete payload.processed;
			const global = PluginMocks.notification(true);
			const tok = Tokens.iatPostMeta;
			const token = {
				data: {
					access_token: tok._id
				}
			};
			axios.mockResolvedValue({ data: not });
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');
			mockingoose(ModelG).toReturn(grp, 'findOne');
			mockingoose(ModelC).toReturn(client, 'findOne');
			cl.generateClientCredentialToken.mockResolvedValue(token);
			const result = await notify.sendNotification(not, global, null);
			const expectedOptions = {
				method: 'POST',
				headers: {
					'Authorization': `bearer ${token.data.access_token}`
				},
				data: payload,
				url: not.destinationUri
			};
			expect(ModelG.Query.prototype.findOne).toHaveBeenCalled();
			expect(ModelC.Query.prototype.findOne).toHaveBeenCalled();
			expect(cl.generateClientCredentialToken).toHaveBeenCalled();
			const clGenArgs = cl.generateClientCredentialToken.mock.calls[0];
			expect(clGenArgs[2]).toBe(`api:write group:${grp._id}`);
			expect(axios).toHaveBeenCalled();
			const args = axios.mock.calls[0];
			expect(args[0]).toMatchObject(expectedOptions);
			expect(Model.Query.prototype.findOneAndUpdate).toHaveBeenCalledWith({ _id: not._id }, { processed: true }, { new: true});
			const res = JSON.parse(JSON.stringify(result.data));
			expect(res._id).toBe(updated._id);
		} catch (error) {
			t.fail(error);
		}
	});

	it('Send Notification with token but without destinationUri', async () => {
		try {
			const not = NotifyMocks.newNotification();
			delete not.destinationUri;
			const updated = JSON.parse(JSON.stringify(not));
			updated.processed = true;
			const payload = JSON.parse(JSON.stringify(not));
			delete payload.processed;
			const global = PluginMocks.notification(true);
			const tok = Tokens.iatPostMeta;
			const token = {
				data: {
					access_token: tok._id
				}
			};
			axios.mockResolvedValue({ data: not });
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');
			await notify.sendNotification(not, global, token);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.message).toBe('Requested notification does not seem to be valid');
		}
	});

	it('Send Notification and have axios fail', async () => {
		try {
			const not = NotifyMocks.newNotification();
			const updated = JSON.parse(JSON.stringify(not));
			updated.processed = true;
			const payload = JSON.parse(JSON.stringify(not));
			delete payload.processed;
			const global = PluginMocks.notification(true);
			const tok = Tokens.iatPostMeta;
			const token = {
				data: {
					access_token: tok._id
				}
			};
			axios.mockRejectedValue({ status: 400 });
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');
			await notify.sendNotification(not, global, token);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.status).toBe(400);
		}
	});

	it('Process notification', async () => {
		try {
			const not = NotifyMocks.newNotification();
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			const client = PluginMocks.notificationClient();
			grp.id = grp._id;
			const updated = JSON.parse(JSON.stringify(not));
			updated.processed = true;
			// adjusting this to expected return after object string/parse in the function
			const payload = JSON.parse(JSON.stringify(not));
			payload.id = payload._id;
			delete payload.processed;
			delete payload._id;
			delete payload.createdAt;
			delete payload.__v;

			const global = PluginMocks.notification(true);
			const tok = Tokens.iatPostMeta;
			const token = {
				data: {
					access_token: tok._id
				}
			};
			axios.mockResolvedValue({ data: not });
			mockingoose(Model).toReturn(not, 'findOne');
			mockingoose(Model).toReturn(updated, 'findOneAndUpdate');
			mockingoose(ModelG).toReturn(grp, 'findOne');
			mockingoose(ModelC).toReturn(client, 'findOne');
			cl.generateClientCredentialToken.mockResolvedValue(token);
			const result = await notify.processNotification(global, grp, not._id);
			expect(Model.Query.prototype.findOne).toHaveBeenCalledWith({ _id: not._id, authGroupId: grp._id });
			const expectedOptions = {
				method: 'POST',
				headers: {
					'Authorization': `bearer ${token.data.access_token}`
				},
				data: payload,
				url: not.destinationUri
			};
			expect(axios).toHaveBeenCalled();
			const args = axios.mock.calls[0];
			console.info(args[0]);
			expect(args[0]).toMatchObject(expectedOptions);
			expect(Model.Query.prototype.findOneAndUpdate).toHaveBeenCalledWith({ _id: not._id }, { processed: true }, { new: true});

			const res = JSON.parse(JSON.stringify(result));
			expect(res.id).toBe(updated._id);
		} catch (error) {
			t.fail(error);
		}
	});

	it('Process notification when id returns unknown', async () => {
		let not;
		try {
			not = NotifyMocks.newNotification();
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			const global = PluginMocks.notification(true);
			mockingoose(Model).toReturn(undefined, 'findOne');
			await notify.processNotification(global, grp, not._id);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.message).toBe(`Unknown notification id: ${not._id}`);
		}
	});

	it('Process notification which is already processed true', async () => {
		try {
			const not = NotifyMocks.newNotification();
			not.processed = true;
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			const payload = JSON.parse(JSON.stringify(not));
			payload.id = payload._id;
			delete payload._id;
			delete payload.createdAt;
			delete payload.__v;
			const global = PluginMocks.notification(true);
			mockingoose(Model).toReturn(not, 'findOne');
			const result = await notify.processNotification(global, grp, not._id);
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(payload);
		} catch (error) {
			t.fail(error);
		}
	});

});