import t from './testhelper';
import { v4 as uuid } from 'uuid';
import qs from 'qs';

// Axios
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
const maxios = new MockAdapter(axios);


//Mocks
import {ClientMocks, GroupMocks, Tokens} from './models';

//Models
import ModelC from '../api/oidc/models/client';
import ModelIAT from '../api/oidc/models/initialAccessToken';
import ModelRat from '../api/oidc/models/registrationAccessToken';
import ModelS from '../api/oidc/models/session';
import Group from '../api/authGroup/model';

//Libs
import iat from '../api/oidc/initialAccess/iat';
import rat from '../api/oidc/regAccess/rat';
import client from '../api/oidc/client/clients';
import session from '../api/oidc/session/session';

const mockingoose = require('mockingoose');
const config = require('../config');
const cryptoRandomString = require('crypto-random-string');

describe('OIDC OP interface functions - CLIENTS', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockingoose.resetAll();
		ModelC.Query.prototype.save.mockClear();
		ModelC.Query.prototype.find.mockClear();
		ModelC.Query.prototype.findOne.mockClear();
		ModelC.Query.prototype.findOneAndUpdate.mockClear();
		ModelIAT.Query.prototype.save.mockClear();
		ModelIAT.Query.prototype.findOne.mockClear();
		mockingoose(Group).toReturn(GroupMocks.group, 'findOne');
		maxios.resetHistory();
		maxios.resetHandlers();
		maxios.reset();
	});

	it('Generate Client - grp has primaryDomain', async () => {
		try {
			const AG = GroupMocks.newGroup('TEST', 'tst', false, false);
			const grp = JSON.parse(JSON.stringify(AG));
			grp.id = grp._id;
			delete grp._id;
			delete grp.active;
			delete grp.owner;
			delete grp.__v;
			const result = await client.generateClient(grp);
			expect(ModelC.Query.prototype.findOneAndUpdate).toHaveBeenCalled();
			expect(result.auth_group).toBe(grp.id);
			expect(result.grant_types).toMatchObject(['client_credentials', 'authorization_code', 'refresh_token']);
			expect(result.response_types).toMatchObject(['code']);
			const expectedURIs = [
				`https://${config.UI_URL}`,
				`https://${config.UI_URL}${config.UI_LOGIN_REDIRECT_PATH}`,
				`https://${config.UI_URL}${config.UI_REFRESH_REDIRECT_PATH}`,
				`https://${config.SWAGGER}/oauth2-redirect.html`];
			expect(result.redirect_uris).toMatchObject(expectedURIs);
			if (grp.primaryDomain !== config.UI_URL) {
				expect(result.post_logout_redirect_uris).toMatchObject([`https://${config.UI_URL}`, `https://${config.UI_URL}${config.UI_LOGOUT_REDIRECT_PATH}`, `https://${config.SWAGGER}/oauth2-redirect.html`, grp.primaryDomain]);
			} else {
				expect(result.post_logout_redirect_uris).toMatchObject([`https://${config.UI_URL}`, `https://${config.SWAGGER}/oauth2-redirect.html`]);
			}
		} catch (error) {
			t.fail(error);
		}
	});

	it('Generate Client - grp does not have primaryDomain', async () => {
		try {
			const AG = GroupMocks.newGroup('TEST', 'tst', false, false);
			const grp = JSON.parse(JSON.stringify(AG));
			grp.id = grp._id;
			delete grp._id;
			delete grp.active;
			delete grp.owner;
			delete grp.__v;
			delete grp.primaryDomain;
			const result = await client.generateClient(grp);
			expect(ModelC.Query.prototype.findOneAndUpdate).toHaveBeenCalled();
			expect(result.auth_group).toBe(grp.id);
			expect(result.grant_types).toMatchObject(['client_credentials', 'authorization_code', 'refresh_token']);
			expect(result.response_types).toMatchObject(['code']);
			expect(result.redirect_uris).toMatchObject([`https://${config.UI_URL}`, `https://${config.UI_URL}${config.UI_LOGIN_REDIRECT_PATH}`, `https://${config.UI_URL}${config.UI_REFRESH_REDIRECT_PATH}`, `https://${config.SWAGGER}/oauth2-redirect.html`]);
			expect(result.post_logout_redirect_uris).toMatchObject([`https://${config.UI_URL}`, `https://${config.UI_URL}${config.UI_LOGOUT_REDIRECT_PATH}`, `https://${config.SWAGGER}/oauth2-redirect.html`]);
		} catch (error) {
			t.fail(error);
		}
	});

	it('Generate Notification Client', async () => {
		try {
			const AG = GroupMocks.newGroup('TEST', 'tst', false, false);
			const grp = JSON.parse(JSON.stringify(AG));
			grp.id = grp._id;
			delete grp._id;
			delete grp.active;
			delete grp.owner;
			delete grp.__v;
			delete grp.primaryDomain;
			const result = await client.generateNotificationServiceClient(grp);
			expect(ModelC.Query.prototype.findOneAndUpdate).toHaveBeenCalled();
			expect(result.auth_group).toBe(grp.id);
			expect(result.grant_types).toMatchObject(['client_credentials']);
			expect(result.response_types).toMatchObject([]);
			expect(result.redirect_uris).toMatchObject([`https://${config.UI_URL}`]);
			expect(result.post_logout_redirect_uris).toMatchObject([]);
			expect(result.scope).toBe('api:read api:write');
		} catch (error) {
			t.fail(error);
		}
	});

	it('Generate Client Credential', async () => {
		try {
			const AG = GroupMocks.newGroup('TEST', 'tst', false, false);
			const grp = JSON.parse(JSON.stringify(AG));
			grp.id = grp._id;
			delete grp._id;
			delete grp.active;
			delete grp.owner;
			delete grp.__v;
			delete grp.primaryDomain;
			maxios.onAny().reply(200, { access_token: cryptoRandomString({length: 21, type: 'url-safe'}) })
			//axios.mockResolvedValue({ access_token: cryptoRandomString({length: 21, type: 'url-safe'}) });
			const client_id = uuid();
			const client_secret = cryptoRandomString({length: 40, type: 'url-safe'});
			await client.generateClientCredentialToken(grp,
				{ _id: client_id, payload: { client_id, client_secret }},
				'api:read',
				'https://test.com'
			);
			//setup for axios call
			const iss = `${config.PROTOCOL}://${config.SWAGGER}/root`;
			const data = {
				'grant_type': 'client_credentials',
				'scope': 'api:read',
				'resource': 'https://test.com'
			};
			const options = {
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					'authorization': `basic ${Buffer.from(`${client_id}:${client_secret}`).toString('base64')}`
				},
				data: qs.stringify(data),
				url: `${iss}/token`,
			};
			expect(maxios.history.post.length).toBe(1);
			console.info(maxios.history.post[1]);
			//expect(JSON.parse(maxios.history.post[1].data)._id).toBe(payload._id);
			//expect(axios).toHaveBeenCalledWith(options);
		} catch (error) {
			t.fail(error);
		}
	});

	it('CheckAlowed - only certain fields can be PATCHED outside OP flow - ensure valid changes return true', async () => {
		try {
			const cl = ClientMocks.newClient('Original');
			const patched = JSON.parse(JSON.stringify(cl));
			patched.client_name = 'Changed';
			patched.subject_type = 'private';
			patched.grant_types = [];
			patched.redirect_uris = [];
			patched.response_types = [];
			patched.application_type = 'mobile';
			patched.require_auth_time = true;
			patched.token_endpoint_auth_method = 'PUT';
			patched.introspection_endpoint_auth_method = 'PUT';
			patched.revocation_endpoint_auth_method = 'PUT';
			const result = await client.checkAllowed({ payload: cl }, { payload: patched });
			expect(result).toBe(true);
		} catch (error) {
			t.fail(error);
		}
	});

	it('CheckAlowed - only certain fields can be PATCHED outside OP flow - ensure invalid changes return false', async () => {
		try {
			const cl = ClientMocks.newClient('Original');
			const patched = JSON.parse(JSON.stringify(cl));
			patched.id = 'abc123';
			const result = await client.checkAllowed({ payload: cl }, { payload: patched });
			expect(result).toBe(false);
		} catch (error) {
			t.fail(error);
		}
	});

	it('ValidateUnique - get a count returned and ensure the query is correct - return false', async () => {
		try {
			const cl = ClientMocks.newClient();
			const AG = GroupMocks.newGroup('TEST', 'tst', false, false);
			mockingoose(ModelC).toReturn([{ _id: cl.client_id, payload: cl} ], 'find');
			mockingoose(ModelC).toReturn(1, 'countDocuments');
			const result = await client.validateUniqueNameGroup(AG, cl.client_name, cl.client_id);
			expect(ModelC.Query.prototype.find).toHaveBeenCalled();
			const query =  {
				'payload.client_name': cl.client_name,
				'$or': [
					{
						'payload.auth_group': AG._id
					},
					{
						'payload.auth_group': AG.prettyName
					}
				],
				'_id': {
					'$ne': cl.client_id
				}
			};
			const args = ModelC.Query.prototype.find.mock.calls;
			expect(args[1][0]).toMatchObject(query);
			expect(result).toBe(false);
		} catch (error) {
			t.fail(error);
		}
	});

	it('ValidateUnique - query is correct - return true', async () => {
		try {
			const cl = ClientMocks.newClient();
			const AG = GroupMocks.newGroup('TEST', 'tst', false, false);
			mockingoose(ModelC).toReturn([], 'find');
			mockingoose(ModelC).toReturn(0, 'countDocuments');
			const result = await client.validateUniqueNameGroup(AG, cl.client_name, cl.client_id);
			expect(ModelC.Query.prototype.find).toHaveBeenCalled();
			const query =  {
				'payload.client_name': cl.client_name,
				'$or': [
					{
						'payload.auth_group': AG._id
					},
					{
						'payload.auth_group': AG.prettyName
					}
				],
				'_id': {
					'$ne': cl.client_id
				}
			};
			const args = ModelC.Query.prototype.find.mock.calls;
			expect(args[1][0]).toMatchObject(query);
			expect(result).toBe(true);
		} catch (error) {
			t.fail(error);
		}
	});

	it('rotateSecret works as expected', async () => {
		try {
			const cl = ClientMocks.newClient();
			const AG = GroupMocks.newGroup('TEST', 'tst', false, false);
			mockingoose(ModelC).toReturn(cl, 'findOneAndUpdate');
			await client.rotateSecret(cl.client_id, AG);
			expect(ModelC.Query.prototype.findOneAndUpdate).toHaveBeenCalled();
			const args = ModelC.Query.prototype.findOneAndUpdate.mock.calls[0];
			expect(args[0]).toMatchObject(      {
				'_id': cl.client_id,
				'$or': [
					{
						'payload.auth_group': AG._id
					},
					{
						'payload.auth_group': AG.prettyName
					}
				]
			});
			expect(Object.keys(args[1])[0]).toBe('payload.client_secret');
			expect(args[2]).toMatchObject({ new: true });
		} catch (error) {
			t.fail(error);
		}
	});
});

describe('OIDC OP interface functions - IAT', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockingoose.resetAll();
		ModelIAT.Query.prototype.save.mockClear();
		ModelIAT.Query.prototype.findOne.mockClear();
		mockingoose(Group).toReturn(GroupMocks.group, 'findOne');
	});

	it('generateIAT - create an initial access token', async () => {
		try {
			const meta = {
				sub: uuid(),
				email: 'test@unitedeffects.com',
				uid: uuid()
			};
			const iTokPost = Tokens.iatPostMeta;
			const AG = GroupMocks.newGroup();
			AG.id = AG._id;
			mockingoose(ModelIAT).toReturn(iTokPost, 'findOneAndUpdate');
			await iat.generateIAT(10000, ['auth_group'], AG, meta);
			expect(ModelIAT.Query.prototype.findOneAndUpdate).toHaveBeenCalled();
			const args = ModelC.Query.prototype.findOneAndUpdate.mock.calls;
			const query1 = {
				$set: {
					payload: {
						iat: expect.any(Number),
						exp: expect.any(Number),
						policies: [
							'auth_group'
						],
						kind: 'InitialAccessToken',
						jti: expect.any(String),
					},
					expiresAt: expect.any(String)
				},
				$setOnInsert: {
					'__v': 0
				}
			};
			const query2 = {
				'payload.auth_group': AG._id,
				'payload.sub': meta.sub,
				'payload.email': meta.email,
				'payload.uid': meta.uid
			}
			const argQ1 = JSON.parse(JSON.stringify(args[0][1]));
			const argQ2 = JSON.parse(JSON.stringify(args[1][1]));
			expect(argQ1).toEqual(expect.objectContaining(query1));
			expect(argQ2).toEqual(expect.objectContaining(query2));
			expect(args[0][0]._id).toBe(args[1][0]._id);
		} catch (error) {
			t.fail(error);
		}
	});

	it('generateIAT - create an initial access token with non-configured policy - error', async () => {
		try {
			const meta = {
				sub: uuid(),
				email: 'test@unitedeffects.com',
				uid: uuid()
			};
			const iTokPre = Tokens.iatPreMeta;
			const iTokPost = Tokens.iatPostMeta;
			const AG = GroupMocks.newGroup();
			mockingoose(ModelIAT).toReturn(iTokPre, 'save');
			mockingoose(ModelIAT).toReturn(iTokPost, 'findOneAndUpdate');
			await iat.generateIAT(10000, ['auth_group', 'fail_policy'], AG, meta);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.message).toBe('policy fail_policy not configured');
		}
	});

	it('generateIAT - create an initial access token without authgroup - error', async () => {
		try {
			const meta = {
				sub: uuid(),
				email: 'test@unitedeffects.com',
				uid: uuid()
			};
			const iTokPre = Tokens.iatPreMeta;
			const iTokPost = Tokens.iatPostMeta;
			mockingoose(ModelIAT).toReturn(iTokPre, 'save');
			mockingoose(ModelIAT).toReturn(iTokPost, 'findOneAndUpdate');
			await iat.generateIAT(10000, ['auth_group', 'fail_policy'], null, meta);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.message).toBe('authGroup not defined');
		}
	});
});

describe('OIDC OP interface functions - Registration Access Token', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockingoose.resetAll();
		ModelRat.Query.prototype.save.mockClear();
		ModelRat.Query.prototype.findOne.mockClear();
		ModelRat.Query.prototype.findOneAndUpdate.mockClear();
		ModelRat.Query.prototype.findOneAndRemove.mockClear();
		mockingoose(Group).toReturn(GroupMocks.group, 'findOne');
	});

	it('regAccessToken - create a registration access token', async () => {
		try {
			//using this as a placeholder for the regaccesstoken since we don't care about the response
			const iTokPost = Tokens.iatPostMeta;
			const AG = GroupMocks.newGroup();
			const cl = uuid();
			AG.id = AG._id;
			mockingoose(ModelRat).toReturn(iTokPost, 'findOne');
			mockingoose(ModelRat).toReturn(iTokPost, 'findOneAndUpdate');
			mockingoose(ModelRat).toReturn(iTokPost, 'findOneAndRemove');
			await rat.regAccessToken(cl, AG);
			expect(ModelRat.Query.prototype.findOneAndUpdate).toHaveBeenCalled();
			expect(ModelRat.Query.prototype.findOne).toHaveBeenCalled();
			expect(ModelRat.Query.prototype.findOneAndRemove).toHaveBeenCalled();
			const args = ModelRat.Query.prototype.findOneAndUpdate.mock.calls[0];
			const query =       {
				"$set": {
					"payload": {
						"iat": expect.any(Number),
						"clientId": cl,
						"policies": [
							"auth_group"
						],
						"kind": "RegistrationAccessToken",
						"jti": expect.any(String)
					}
				},
				"$setOnInsert": {
					"__v": 0
				}
			};
			const argQ = JSON.parse(JSON.stringify(args[1]));
			expect(argQ).toEqual(expect.objectContaining(query));
		} catch (error) {
			t.fail(error);
		}
	});

	it('regAccessToken - create a registration access token - no previous one found', async () => {
		try {
			//using this as a placeholder for the regaccesstoken since we don't care about the response
			const iTokPost = Tokens.iatPostMeta;
			const AG = GroupMocks.newGroup();
			const cl = uuid();
			AG.id = AG._id;
			mockingoose(ModelRat).toReturn(undefined, 'findOne');
			mockingoose(ModelRat).toReturn(iTokPost, 'findOneAndUpdate');
			mockingoose(ModelRat).toReturn(iTokPost, 'findOneAndRemove');
			await rat.regAccessToken(cl, AG);
			expect(ModelRat.Query.prototype.findOneAndUpdate).toHaveBeenCalled();
			expect(ModelRat.Query.prototype.findOne).toHaveBeenCalled();
			expect(ModelRat.Query.prototype.findOneAndRemove).not.toHaveBeenCalled();
			const args = ModelRat.Query.prototype.findOneAndUpdate.mock.calls[0];
			const query =       {
				"$set": {
					"payload": {
						"iat": expect.any(Number),
						"clientId": cl,
						"policies": [
							"auth_group"
						],
						"kind": "RegistrationAccessToken",
						"jti": expect.any(String)
					}
				},
				"$setOnInsert": {
					"__v": 0
				}
			};
			const argQ = JSON.parse(JSON.stringify(args[1]));
			expect(argQ).toEqual(expect.objectContaining(query));
		} catch (error) {
			t.fail(error);
		}
	});

	it('regAccessToken - no authgroup provided - error', async () => {
		try {
			//using this as a placeholder for the regaccesstoken since we don't care about the response
			const iTokPost = Tokens.iatPostMeta;
			mockingoose(ModelRat).toReturn(iTokPost, 'findOne');
			mockingoose(ModelRat).toReturn(iTokPost, 'findOneAndUpdate');
			mockingoose(ModelRat).toReturn(true, 'findOneAndRemove');
			await rat.regAccessToken(uuid(), null);
			t.fail('SHOULD NOT BE HERE');
		} catch (error) {
			expect(error.message).toBe('authGroup not defined');
		}
	});
});


describe('OIDC OP interface functions - Session', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockingoose.resetAll();
		ModelS.Query.prototype.deleteMany.mockClear();
		mockingoose(Group).toReturn(GroupMocks.group, 'findOne');
	});

	it('remove session by account Id', async () => {
		try {
			const accountId = uuid();
			mockingoose(ModelS).toReturn({}, 'deleteMany');
			await session.removeSessionByAccountId(accountId);
			expect(ModelS.Query.prototype.deleteMany).toHaveBeenCalled();
			const args = ModelS.Query.prototype.deleteMany.mock.calls[0];
			expect(args[0]).toMatchObject({
				'payload.accountId': accountId,
				'payload.kind': 'Session'
			});
		} catch (error) {
			t.fail(error);
		}
	});
});
