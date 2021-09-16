import '@babel/register';
import 'regenerator-runtime/runtime';
import t from './testhelper';
import { v4 as uuid } from 'uuid';
import qs from 'qs';

// Axios
import axios from 'axios';
jest.mock('axios');

//Mocks
import { GroupMocks } from './models';

//Models
import ModelC from '../src/api/oidc/models/client';
import ModelIAT from '../src/api/oidc/models/initialAccessToken';

//Libs
import iat from '../src/api/oidc/initialAccess/iat';
import client from '../src/api/oidc/client/clients';

const mockingoose = require('mockingoose');
const config = require('../src/config');
const cryptoRandomString = require('crypto-random-string');

describe('OIDC OP interface functions', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockingoose.resetAll();
		ModelC.Query.prototype.save.mockClear();
		ModelC.Query.prototype.findOne.mockClear();
		ModelC.Query.prototype.findOneAndUpdate.mockClear();
		ModelIAT.Query.prototype.save.mockClear();
		ModelIAT.Query.prototype.findOne.mockClear();
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
			expect(result.grant_types).toMatchObject(['client_credentials', 'authorization_code', 'implicit']);
			expect(result.response_types).toMatchObject(['code id_token', 'code', 'id_token']);
			expect(result.redirect_uris).toMatchObject([`https://${config.UI_URL}`]);
			if (grp.primaryDomain !== config.UI_URL) {
				expect(result.post_logout_redirect_uris).toMatchObject([`https://${config.UI_URL}`, `https://${config.SWAGGER}/oauth2-redirect.html`, grp.primaryDomain]);
			} else {
				expect(result.post_logout_redirect_uris).toMatchObject([`https://${config.UI_URL}`, `https://${config.SWAGGER}/oauth2-redirect.html`]);
			}
		} catch (error) {
			console.error(error);
			t.fail();
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
			expect(result.grant_types).toMatchObject(['client_credentials', 'authorization_code', 'implicit']);
			expect(result.response_types).toMatchObject(['code id_token', 'code', 'id_token']);
			expect(result.redirect_uris).toMatchObject([`https://${config.UI_URL}`]);
			expect(result.post_logout_redirect_uris).toMatchObject([`https://${config.UI_URL}`, `https://${config.SWAGGER}/oauth2-redirect.html`]);
		} catch (error) {
			console.error(error);
			t.fail();
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
			console.info(result);
			//expect(ModelC.Query.prototype.findOneAndUpdate).toHaveBeenCalled();
			expect(result.auth_group).toBe(grp.id);
			expect(result.grant_types).toMatchObject(['client_credentials']);
			expect(result.response_types).toMatchObject([]);
			expect(result.redirect_uris).toMatchObject([`https://${config.UI_URL}`]);
			expect(result.post_logout_redirect_uris).toMatchObject([]);
			expect(result.scope).toBe('api:read api:write');
		} catch (error) {
			console.error(error);
			t.fail();
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
			axios.mockResolvedValue({ access_token: cryptoRandomString({length: 21, type: 'url-safe'}) });
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
			expect(axios).toHaveBeenCalledWith(options);
		} catch (error) {
			console.error(error);
			t.fail();
		}
	});

});