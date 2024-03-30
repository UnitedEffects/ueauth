import Model from '../api/plugins/model';
import { v4 as uuid } from 'uuid';
import dal from '../api/plugins/dal';
import plugins from '../api/plugins/plugins';
import { GroupMocks, PluginMocks } from './models';

// mocks for Group
import ModelG from '../api/authGroup/model';
import t from './testhelper';

// Clients
import cl from '../api/oidc/client/clients';

const mockingoose = require('mockingoose');
const config = require('../config');

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
			const mClG = jest
				.spyOn(cl, 'generateNotificationServiceClient')
				.mockResolvedValue(client);
			const mCLD = jest
				.spyOn(cl, 'deleteNotificationsServiceClient')
				.mockResolvedValue(true);
			mockingoose(Model).toReturn(plg, 'findOne');
			mockingoose(Model).toReturn(updated, 'save');
			const result = await plugins.toggleGlobalNotifications(data, uuid(), grp);
			expect(mClG).toHaveBeenCalledWith(grp);
			expect(Model.prototype.save).toHaveBeenCalled();
			expect(Model.Query.prototype.findOne).toHaveBeenCalled();
			expect(result).toMatchObject(expected);
			mClG.mockRestore();
			mCLD.mockRestore();
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
			const mCLD = jest
				.spyOn(cl, 'deleteNotificationsServiceClient')
				.mockResolvedValue(true);
			mockingoose(Model).toReturn(og, 'findOne');
			mockingoose(Model).toReturn(plg, 'save');
			const result = await plugins.toggleGlobalNotifications(data, uuid(), grp);
			expect(mCLD).toHaveBeenCalled();
			expect(Model.prototype.save).toHaveBeenCalled();
			expect(Model.Query.prototype.findOne).toHaveBeenCalled();
			expect(result).toMatchObject(expected);
			mCLD.mockRestore();
		} catch (error) {
			t.fail(error);
		}
	});

	it('toggle global notifications plugin with wrong versions', async () => {
		const mCLD = jest
			.spyOn(cl, 'deleteNotificationsServiceClient')
			.mockResolvedValue(true);
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

			mockingoose(Model).toReturn(og, 'findOne');
			mockingoose(Model).toReturn(plg, 'save');
			await plugins.toggleGlobalNotifications(data, uuid(), grp);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.output.statusCode).toBe(400);
			expect(error.output.payload.message).toBe( 'Must provide the current version to be incremented. If you thought you did, someone may have updated this before you.');
			mCLD.mockRestore();
		}
	});

	it('toggle global notifications plugin with no version provided', async () => {
		const mCLD = jest
			.spyOn(cl, 'deleteNotificationsServiceClient')
			.mockResolvedValue(true);
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
			mockingoose(Model).toReturn(og, 'findOne');
			mockingoose(Model).toReturn(plg, 'save');
			await plugins.toggleGlobalNotifications(data, uuid(), grp);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.output.statusCode).toBe(400);
			expect(error.output.payload.message).toBe( 'Must provide the current version to be incremented. If you thought you did, someone may have updated this before you.');
			mCLD.mockRestore();
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