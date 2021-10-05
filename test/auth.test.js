import '@babel/register';
import 'regenerator-runtime/runtime';
import { v4 as uuid } from 'uuid';
import { nanoid } from 'nanoid';
import Model from '../src/api/accounts/model';
import auth from '../src/auth/auth';

import {AccountMocks, GroupMocks, NotifyMocks, PluginMocks, Tokens} from './models';
import t from './testhelper';


// Clients
import ModelC from '../src/api/oidc/models/client';

const mockingoose = require('mockingoose');
const config = require('../src/config');

describe('Auth Functions', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockingoose.resetAll();
		Model.Query.prototype.save.mockClear();
		Model.Query.prototype.findOne.mockClear();
		Model.Query.prototype.findOneAndUpdate.mockClear();
		ModelC.Query.prototype.findOne.mockClear();
	});

	it('get user claims', async () => {
		try {
			// create authgroup object
			const grp = GroupMocks.newGroup('TEST', 'tst', false, false);
			// create random token
			const token = Tokens.opaque_access_token;
			// define an account to return
			const act = AccountMocks.randomAccount();
			act.authGroup = grp._id;
			const lookup = {
				sub: act._id
			};
			mockingoose(Model).toReturn(act, 'findOne');
			const result = await auth.getUser(grp, lookup, token);
			expect(Model.Query.prototype.findOne).toHaveBeenCalled();
			// expected claims
			const expected = {
				sub: act._id,
				group: grp._id,
				username: act.username,
				email: act.email,
				verified: act.verified
			};
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('get client', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('TEST', 'tst', false, false);
			// mock a client
			const client = PluginMocks.notificationClient();
			mockingoose(ModelC).toReturn({ _id: client.client_id, payload: client }, 'findOne');
			const result = await auth.getClient(grp, { sub: client.client_id });
			expect(ModelC.Query.prototype.findOne).toHaveBeenCalled();
			const res = JSON.parse(JSON.stringify(result));
			expect(res).toMatchObject(client);
		} catch (error) {
			t.fail(error);
		}
	});

	it('run decoded jwt check - no issues', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			// decoded JWT
			const decoded = Tokens.decoded_jwt(true, false, grp);
			decoded.client_id = grp.associatedClient;
			// define an account to return
			const act = AccountMocks.randomAccount();
			act.sub = decoded.sub;
			act.authGroup = grp._id;
			const issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${grp.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${grp.id || grp._id}`];
			mockingoose(Model).toReturn(act, 'findOne');
			const result = await auth.runDecodedChecks(decoded.jti, issuer, decoded, grp);
			const expected = {
				sub: act.sub,
				group: grp._id,
				username: act.username,
				email: act.email,
				verified: act.verified,
				decoded,
				subject_group: grp
			};
			expect(result).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('run decoded jwt check - aud as array - no issues', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			// decoded JWT
			const decoded = Tokens.decoded_jwt(true, false, grp);
			decoded.client_id = grp.associatedClient;
			decoded.aud = [decoded.aud, 'http://example.com'];
			// define an account to return
			const act = AccountMocks.randomAccount();
			act.sub = decoded.sub;
			act.authGroup = grp._id;
			const issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${grp.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${grp.id || grp._id}`];
			mockingoose(Model).toReturn(act, 'findOne');
			const result = await auth.runDecodedChecks(decoded.jti, issuer, decoded, grp);
			const expected = {
				sub: act.sub,
				group: grp._id,
				username: act.username,
				email: act.email,
				verified: act.verified,
				decoded,
				subject_group: grp
			};
			expect(result).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});


     // Not sure if we should accept requests without an audience, but for now we do and this test validates the behavior
	it('run decoded jwt check - aud is missing - no issues', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			// decoded JWT
			const decoded = Tokens.decoded_jwt(true, false, grp);
			decoded.client_id = grp.associatedClient;
			delete decoded.aud;
			// define an account to return
			const act = AccountMocks.randomAccount();
			act.sub = decoded.sub;
			act.authGroup = grp._id;
			const issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${grp.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${grp.id || grp._id}`];
			mockingoose(Model).toReturn(act, 'findOne');
			const result = await auth.runDecodedChecks(decoded.jti, issuer, decoded, grp);
			const expected = {
				sub: act.sub,
				group: grp._id,
				username: act.username,
				email: act.email,
				verified: act.verified,
				decoded,
				subject_group: grp
			};
			expect(result).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('run decoded jwt check - include nonce (making it an id_token)', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			// decoded JWT
			const decoded = Tokens.decoded_jwt(true, false, grp);
			decoded.client_id = grp.associatedClient;
			// adding nonce to make it seem like an id_token and create error
			decoded.nonce = '123';
			// define an account to return
			const act = AccountMocks.randomAccount();
			act.sub = decoded.sub;
			act.authGroup = grp._id;
			const issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${grp.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${grp.id || grp._id}`];
			mockingoose(Model).toReturn(act, 'findOne');
			await auth.runDecodedChecks(decoded.jti, issuer, decoded, grp);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.output.statusCode).toBe(401);
		}
	});

	it('run decoded jwt check - wrong iss', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			// decoded JWT
			const decoded = Tokens.decoded_jwt(true, false, grp);
			decoded.client_id = grp.associatedClient;
			// changing iss to mismatch and create error
			decoded.iss = 'http://example.wrong.com';
			// define an account to return
			const act = AccountMocks.randomAccount();
			act.sub = decoded.sub;
			act.authGroup = grp._id;
			const issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${grp.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${grp.id || grp._id}`];
			mockingoose(Model).toReturn(act, 'findOne');
			await auth.runDecodedChecks(decoded.jti, issuer, decoded, grp);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.output.statusCode).toBe(401);
		}
	});

	it('run decoded jwt check - missing group on the jwt', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			// decoded JWT
			const decoded = Tokens.decoded_jwt(true, false, grp);
			decoded.client_id = grp.associatedClient;
			// removing group from token to create error
			delete decoded.group;
			// define an account to return
			const act = AccountMocks.randomAccount();
			act.sub = decoded.sub;
			act.authGroup = grp._id;
			const issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${grp.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${grp.id || grp._id}`];
			mockingoose(Model).toReturn(act, 'findOne');
			await auth.runDecodedChecks(decoded.jti, issuer, decoded, grp);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.output.statusCode).toBe(401);
		}
	});

	it('run decoded jwt check - jwt group not matching authgroup provided', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			// decoded JWT
			const decoded = Tokens.decoded_jwt(true, false, grp);
			decoded.client_id = grp.associatedClient;
			// creating a different group id to throw error
			decoded.group = nanoid();
			// define an account to return
			const act = AccountMocks.randomAccount();
			act.sub = decoded.sub;
			act.authGroup = grp._id;
			const issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${grp.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${grp.id || grp._id}`];
			mockingoose(Model).toReturn(act, 'findOne');
			await auth.runDecodedChecks(decoded.jti, issuer, decoded, grp);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.output.statusCode).toBe(401);
		}
	});

	it('run decoded jwt check - aud is wrong', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			// decoded JWT
			const decoded = Tokens.decoded_jwt(true, false, grp);
			decoded.client_id = grp.associatedClient;
			// changing audience to something unexpected for error
			decoded.aud = 'http://wrong.com';
			// define an account to return
			const act = AccountMocks.randomAccount();
			act.sub = decoded.sub;
			act.authGroup = grp._id;
			const issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${grp.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${grp.id || grp._id}`];
			mockingoose(Model).toReturn(act, 'findOne');
			await auth.runDecodedChecks(decoded.jti, issuer, decoded, grp);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.output.statusCode).toBe(401);
		}
	});

	it('run decoded jwt check - client_id is not group.associatedClient', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			// decoded JWT
			const decoded = Tokens.decoded_jwt(true, false, grp);
			// client id of the token will be different than the group so this should fail
			// ****
			// define an account to return
			const act = AccountMocks.randomAccount();
			act.sub = decoded.sub;
			act.authGroup = grp._id;
			const issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${grp.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${grp.id || grp._id}`];
			mockingoose(Model).toReturn(act, 'findOne');
			await auth.runDecodedChecks(decoded.jti, issuer, decoded, grp);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.output.statusCode).toBe(401);
		}
	});

	it('run decoded jwt check - azp is wrong', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			// decoded JWT
			const decoded = Tokens.decoded_jwt(true, false, grp);
			decoded.client_id = grp.associatedClient;
			// adding azp and making it something other than client_id - throws error
			decoded.azp = uuid();
			// define an account to return
			const act = AccountMocks.randomAccount();
			act.sub = decoded.sub;
			act.authGroup = grp._id;
			const issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${grp.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${grp.id || grp._id}`];
			mockingoose(Model).toReturn(act, 'findOne');
			await auth.runDecodedChecks(decoded.jti, issuer, decoded, grp);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.output.statusCode).toBe(401);
		}
	});

	it('run decoded jwt check - user not returned', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			// decoded JWT
			const decoded = Tokens.decoded_jwt(true, false, grp);
			decoded.client_id = grp.associatedClient;
			// define an account to return
			const act = AccountMocks.randomAccount();
			act.sub = decoded.sub;
			act.authGroup = grp._id;
			const issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${grp.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${grp.id || grp._id}`];
			// despite declaring an account, we will return undefined for this negative test
			mockingoose(Model).toReturn(undefined, 'findOne');
			await auth.runDecodedChecks(decoded.jti, issuer, decoded, grp);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.output.statusCode).toBe(401);
		}
	});

	it('run decoded jwt check - client credential token where sub = client-id - no issue', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			// decoded JWT
			const decoded = Tokens.decoded_jwt(true, false, grp);
			decoded.client_id = grp.associatedClient;
			decoded.sub = decoded.client_id;
			// mock client
			const client = PluginMocks.notificationClient();
			client.client_id = decoded.client_id;
			client.auth_group = grp._id;
			mockingoose(ModelC).toReturn({ _id: client.client_id, payload: client }, 'findOne');
			const issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${grp.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${grp.id || grp._id}`];
			const result = await auth.runDecodedChecks(decoded.jti, issuer, decoded, grp);
			const expected = {
				client_credential: true,
				sub: decoded.sub,
				client_id: client.client_id,
				client_name: client.client_name,
				application_type: 'web',
				subject_type: 'public',
				require_auth_time: false,
				auth_group: client.auth_group,
				decoded,
				subject_group: grp
			};
			expect(result).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('run decoded jwt check - client credential token where sub = undefined - no issue', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			// decoded JWT
			const decoded = Tokens.decoded_jwt(true, false, grp);
			decoded.client_id = grp.associatedClient;
			delete decoded.sub;
			// mock client
			const client = PluginMocks.notificationClient();
			client.client_id = decoded.client_id;
			client.auth_group = grp._id;
			mockingoose(ModelC).toReturn({ _id: client.client_id, payload: client }, 'findOne');
			const issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${grp.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${grp.id || grp._id}`];
			const result = await auth.runDecodedChecks(decoded.jti, issuer, decoded, grp);
			const expected = {
				client_credential: true,
				sub: decoded.client_id,
				client_id: client.client_id,
				client_name: client.client_name,
				application_type: 'web',
				subject_type: 'public',
				require_auth_time: false,
				auth_group: client.auth_group,
				decoded,
				subject_group: grp
			};
			expect(result).toMatchObject(expected);
		} catch (error) {
			t.fail(error);
		}
	});

	it('run decoded jwt check - client credential token where client not found', async () => {
		try {
			// mock authgroup object
			const grp = GroupMocks.newGroup('UE Core', 'root', true, false);
			// decoded JWT
			const decoded = Tokens.decoded_jwt(true, false, grp);
			decoded.client_id = grp.associatedClient;
			delete decoded.sub;
			// mock client
			const client = PluginMocks.notificationClient();
			client.client_id = decoded.client_id;
			client.auth_group = grp._id;
			// breaking by returning undefined for negative test
			mockingoose(ModelC).toReturn(undefined, 'findOne');
			const issuer = [`${config.PROTOCOL}://${config.SWAGGER}/${grp.prettyName}`,`${config.PROTOCOL}://${config.SWAGGER}/${grp.id || grp._id}`];
			await auth.runDecodedChecks(decoded.jti, issuer, decoded, grp);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.output.statusCode).toBe(401);
		}
	});
});