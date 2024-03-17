import '@babel/register';
import 'regenerator-runtime/runtime';
import Model from '../src/api/plugins/model';
import { v4 as uuid } from 'uuid';
import dal from '../src/api/plugins/dal';
import plugins from '../src/api/plugins/plugins';
import { GroupMocks, PluginMocks } from './models';

// mocks for Group
import ModelG from '../src/api/authGroup/model';
import t from './testhelper';

// Clients
import cl from '../src/api/oidc/client/clients';
jest.mock('../src/api/oidc/client/clients');

const mockingoose = require('mockingoose');
const config = require('../src/config');

describe('Plugins', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockingoose.resetAll();
		Model.Query.prototype.save.mockClear();
		Model.Query.prototype.findOne.mockClear();
		Model.Query.prototype.findOneAndUpdate.mockClear();
		ModelG.Query.prototype.findOne.mockClear();
	});

	it('Initialize plugins', async () => {
		try {
			const plg = PluginMocks.global;
			plg.createdBy =  config.ROOT_EMAIL;
			const expected = JSON.parse(JSON.stringify(plg));
			expected.id = expected._id;
			delete expected.__v;
			delete expected._id;
			mockingoose(Model).toReturn(plg, 'save');
			const result = await plugins.initPlugins();
			const res = JSON.parse(JSON.stringify(result));
			expect(Model.prototype.save).toHaveBeenCalled();
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('toggle global notifications plugin on', async () => {
		try {
			const plg = PluginMocks.global;
			const client = PluginMocks.notificationClient();
			plg.createdBy =  config.ROOT_EMAIL;
			const updated = JSON.parse(JSON.stringify(plg));
			updated.version = 2;
			updated.notifications.enabled = true;
			updated.notifications.notificationServiceUri = 'http://localhost:8080';
			updated.notifications.registeredClientId = client.client_id;
			const expected = {
				notifications: {
					enabled: true,
					notificationServiceUri: 'http://localhost:8080',
					notificationServiceClientId: client.client_id,
					notificationServiceClientSecret: client.client_secret,
					plugins: {version: 2}
				}
			};
			const grp = GroupMocks.newGroup('UE Core', 'root', true, true);
			const data = { enabled: true, currentVersion: 1, notificationServiceUri: 'http://localhost:8080' };
			cl.generateNotificationServiceClient.mockResolvedValue(client);
			cl.deleteNotificationsServiceClient.mockResolvedValue(true);
			mockingoose(Model).toReturn(plg, 'findOne');
			mockingoose(Model).toReturn(updated, 'save');
			const result = await plugins.toggleGlobalNotifications(data, uuid(), grp);
			expect(cl.generateNotificationServiceClient).toHaveBeenCalledWith(grp);
			expect(Model.prototype.save).toHaveBeenCalled();
			expect(Model.Query.prototype.findOne).toHaveBeenCalled();
			expect(result).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('toggle global notifications plugin off', async () => {
		try {
			const plg = PluginMocks.global;
			const client = PluginMocks.notificationClient();
			plg.createdBy =  config.ROOT_EMAIL;
			plg.version = 2;
			const og = JSON.parse(JSON.stringify(plg));
			og.version = 1;
			og.notifications.enabled = true;
			og.notifications.notificationServiceUri = 'http://localhost:8080';
			og.notifications.registeredClientId = client.client_id;
			const expected = {
				notifications: {
					enabled: false,
					notificationServiceUri: undefined,
					notificationServiceClientId: undefined,
					notificationServiceClientSecret: undefined,
					plugins: {version: 2}
				}
			};
			const grp = GroupMocks.newGroup('UE Core', 'root', true, true);
			const data = { enabled: false, currentVersion: 1,  };
			cl.deleteNotificationsServiceClient.mockResolvedValue(true);
			mockingoose(Model).toReturn(og, 'findOne');
			mockingoose(Model).toReturn(plg, 'save');
			const result = await plugins.toggleGlobalNotifications(data, uuid(), grp);
			expect(cl.deleteNotificationsServiceClient).toHaveBeenCalled();
			expect(Model.prototype.save).toHaveBeenCalled();
			expect(Model.Query.prototype.findOne).toHaveBeenCalled();
			expect(result).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('toggle global notifications plugin with wrong versions', async () => {
		try {
			const plg = PluginMocks.global;
			const client = PluginMocks.notificationClient();
			plg.createdBy =  config.ROOT_EMAIL;
			plg.version = 1;
			const og = JSON.parse(JSON.stringify(plg));
			og.version = 2;
			og.notifications.enabled = true;
			og.notifications.notificationServiceUri = 'http://localhost:8080';
			og.notifications.registeredClientId = client.client_id;
			const grp = GroupMocks.newGroup('UE Core', 'root', true, true);
			const data = { enabled: false, currentVersion: 1,  };
			cl.deleteNotificationsServiceClient.mockResolvedValue(true);
			mockingoose(Model).toReturn(og, 'findOne');
			mockingoose(Model).toReturn(plg, 'save');
			await plugins.toggleGlobalNotifications(data, uuid(), grp);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.output.statusCode).toBe(400);
			expect(error.output.payload.message).toBe( 'Must provide the current version to be incremented. If you thought you did, someone may have updated this before you.');
		}
	});

	it('toggle global notifications plugin with no version provided', async () => {
		try {
			const plg = PluginMocks.global;
			const client = PluginMocks.notificationClient();
			plg.createdBy =  config.ROOT_EMAIL;
			plg.version = 1;
			const og = JSON.parse(JSON.stringify(plg));
			og.version = 2;
			og.notifications.enabled = true;
			og.notifications.notificationServiceUri = 'http://localhost:8080';
			og.notifications.registeredClientId = client.client_id;
			const grp = GroupMocks.newGroup('UE Core', 'root', true, true);
			const data = { enabled: false };
			cl.deleteNotificationsServiceClient.mockResolvedValue(true);
			mockingoose(Model).toReturn(og, 'findOne');
			mockingoose(Model).toReturn(plg, 'save');
			await plugins.toggleGlobalNotifications(data, uuid(), grp);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.output.statusCode).toBe(400);
			expect(error.output.payload.message).toBe( 'Must provide the current version to be incremented. If you thought you did, someone may have updated this before you.');
		}
	});

	it('get latest global plugins', async () => {
		try {
			const plg = PluginMocks.global;
			const expected = JSON.parse(JSON.stringify(plg));
			expected.id = expected._id;
			delete expected._id;
			delete expected.__v;
			delete expected.createdAt; // not important for validation
			mockingoose(Model).toReturn(plg, 'findOne');
			const spy = jest.spyOn(dal, 'getLatestPlugins');
			const result = await plugins.getLatestPluginOptions(true);
			//expect(spy).toHaveBeenCalledWith({ 'createdAt': -1, 'version': -1 });
			expect(spy).toHaveBeenCalledWith({ 'version': -1 });
			expect(Model.Query.prototype.findOne).toHaveBeenCalled();
			expect(result).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});
});