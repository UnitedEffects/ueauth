import t from './testhelper';
import middle from '../oidcMiddleware';
import errHandler from '../customErrorHandler';
import Boom from '@hapi/boom';
import {GroupMocks} from './models';
import Model from '../api/authGroup/model';
import cl from '../api/oidc/client/clients';
jest.mock('../api/oidc/client/clients');
import IAT from '../api/oidc/initialAccess/iat';
import ModelC from "../api/oidc/models/client";
jest.mock('../api/oidc/initialAccess/iat');
const mockingoose = require('mockingoose');
const config = require('../config');
const cryptoRandomString = require('crypto-random-string');

import helper from '../helper';


describe('OIDC Pre/Post Middleware', () => {
    beforeEach(() => {
		jest.clearAllMocks();
        mockingoose.resetAll();
		ModelC.Query.prototype.save.mockClear();
		ModelC.Query.prototype.find.mockClear();
		ModelC.Query.prototype.findOne.mockClear();
		ModelC.Query.prototype.findOneAndUpdate.mockClear();
		Model.Query.prototype.save.mockClear();
		Model.Query.prototype.find.mockClear();
		Model.Query.prototype.findOne.mockClear();
		Model.Query.prototype.findOneAndUpdate.mockClear();
    });

	test('validate authgroup for OP koa routes - authgroup defined in ctx', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				req: {
					params: {}
				},
				app: {
					emit: jest.fn()
				}
			};

			await middle.validateAuthGroup(ctx, jest.fn());
			expect(ctx.req.params.group).toBe(authGroup.id);
		} catch (error) {
			t.fail();
		}
	});

	test('validate authgroup for OP koa routes - authgroup defined in ctx but not active - no group provided', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', false, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				req: {
					params: {}
				},
				app: {
					emit: jest.fn()
				}
			};
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.validateAuthGroup(ctx);
			expect(spy).toHaveBeenCalled();
			const args = spy.mock.calls[0];
			expect(args[0].status).toBe(428);
			expect(args[0].body.error).toBe('Precondition Required');
			expect(args[0].body.message).toBe('authGroup is required');
			spy.mockRestore();
		} catch (error) {
			t.fail(error);
		}
	});

	// ctx.authGroup provided authgroup inactive group not defined
	// ctx.authGroup not provided - no group in path
	// ctx.authGroup not provided - not found when searched
	test('validate authgroup for OP koa routes - authgroup missing - no group provided', async () => {
		try {
			const ctx = {
				req: {
					params: {}
				},
				app: {
					emit: jest.fn()
				}
			};
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.validateAuthGroup(ctx);
			expect(spy).toHaveBeenCalled();
			const args = spy.mock.calls[0];
			expect(args[1].output.statusCode).toBe(428);
			expect(args[1].output.payload.error).toBe('Precondition Required');
			expect(args[1].output.payload.message).toBe('authGroup is required');
			spy.mockRestore();
		} catch (error) {
			t.fail(error);
		}
	});


	test('validate authgroup for OP koa routes - authgroup not defined - group provided', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', false, false);
			authGroup.id = authGroup._id;
			const mockGet = jest
				.spyOn(helper, 'cacheAG')
				.mockResolvedValue(authGroup);
			const ctx = {
				req: {
					params: {
						group: 'root'
					},
					query: {}
				},
				app: {
					emit: jest.fn()
				}
			};
			await middle.validateAuthGroup(ctx);
			expect(mockGet).toHaveBeenCalled();
			expect(ctx.authGroup.id).toBe(authGroup.id);
			expect(ctx.authGroup.name).toBe(authGroup.name);
			expect(ctx.authGroup.prettyName).toBe(authGroup.prettyName);
			expect(ctx.req.params.group).toBe(authGroup.id);
			mockGet.mockRestore();
		} catch (error) {
			t.fail(error);
		}
	});

	test('validate authgroup for OP koa routes - authgroup not defined - group provided - not found', async () => {
		try {
			const mockGet = jest
				.spyOn(helper, 'cacheAG')
				.mockImplementation(() => {
					throw Boom.notImplemented('auth group not found');
				})
			const ctx = {
				req: {
					params: {
						group: 'root'
					},
					query: {}
				},
				app: {
					emit: jest.fn()
				}
			};
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.validateAuthGroup(ctx);
			expect(mockGet).toHaveBeenCalled();
			expect(spy).toHaveBeenCalled();
			const args = spy.mock.calls[0];
			//console.info('args', args[1]);
			expect(args[1].output.statusCode).toBe(501);
			expect(args[1].output.payload.error).toBe('Not Implemented');
			expect(args[1].output.payload.message).toBe('auth group not found');
			mockGet.mockRestore();
			spy.mockRestore();
		} catch (error) {
			t.fail(error);
		}
	});

	test('validate cache can return an authgroup when cache is empty (sequence of tests is important) and AG is found', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			mockingoose(Model).toReturn(authGroup, 'findOne');
			const query = {
				active: true,
				$or: [
					{ _id: 'root' },
					{ prettyName: 'root' }
				]
			};
			const result = await helper.cacheAG(false, 'AG', 'root');
			expect(Model.Query.prototype.findOne).toHaveBeenCalledWith(query);
			expect(result._id).toBe(authGroup._id);
		} catch (error) {
			t.fail(error);
		}
	})

	test('validate cache can return an authgroup when cache is not empty (not mocked)', async () => {
		try {
			const result = await helper.cacheAG(false, 'AG', 'root');
			expect(Model.Query.prototype.findOne).not.toHaveBeenCalled();
			expect(result.prettyName).toBe('root');
		} catch (error) {
			t.fail(error);
		}
	})

	test('validate cache can return an authgroup when cache is reset and AG is found - should hit DB', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			mockingoose(Model).toReturn(authGroup, 'findOne');
			const query = {
				active: true,
				$or: [
					{ _id: 'root' },
					{ prettyName: 'root' }
				]
			};
			const result = await helper.cacheAG(true, 'AG', 'root');
			expect(Model.Query.prototype.findOne).toHaveBeenCalledWith(query);
			expect(result._id).toBe(authGroup._id);
		} catch (error) {
			console.error(error);
			t.fail(error);
		}
	})

	test('No deleting authGroup associated client - DELETE method', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				method: 'DELETE',
				path: `/${authGroup.id}/reg/${authGroup.associatedClient}`,
				req: {
					params: {
						group: authGroup.id
					}
				},
				app: {
					emit: jest.fn()
				}
			};
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.noDeleteOnPrimaryClient(ctx, jest.fn());
			expect(spy).toHaveBeenCalled();
			const args = spy.mock.calls[0];
			expect(args[0].status).toBe(400);
			expect(args[0].body.error).toBe('Bad Request');
			expect(args[0].body.message).toBe('You can not delete the primary client of your auth group');
		} catch (error) {
			t.fail(error);
		}
	});

	test('No deleting authGroup associated client - not DELETE method (GET)', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				method: 'GET',
				path: `/${authGroup.id}/reg/${authGroup.associatedClient}`,
				req: {
					params: {
						group: authGroup.id
					}
				},
				app: {
					emit: jest.fn()
				}
			};
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.noDeleteOnPrimaryClient(ctx, jest.fn());
			expect(spy).not.toHaveBeenCalled();
		} catch (error) {
			t.fail(error);
		}
	});

	test('uniqueClientRegCheck - non update or write should not do anything', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				method: 'GET',
				path: `/${authGroup.id}/reg/${authGroup.associatedClient}`,
				req: {
					params: {
						group: authGroup.id
					}
				},
				request: {},
				app: {
					emit: jest.fn()
				}
			};
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.uniqueClientRegCheck(ctx, jest.fn());
			expect(spy).not.toHaveBeenCalled();
		} catch (error) {
			t.fail(error);
		}
	});


	test('uniqueClientRegCheck - POST should continue without error', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				method: 'POST',
				path: `/${authGroup.id}/reg/${authGroup.associatedClient}`,
				req: {
					params: {
						group: authGroup.id
					}
				},
				request: {
					body: {}
				},
				app: {
					emit: jest.fn()
				}
			};
			const mCl = jest
				.spyOn(cl, 'validateUniqueNameGroup')
				.mockResolvedValue(true);
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.uniqueClientRegCheck(ctx, jest.fn());
			expect(mCl).toHaveBeenCalled();
			console.info(ctx);
			expect(spy).not.toHaveBeenCalled();
			spy.mockRestore();
			mCl.mockRestore();
		} catch (error) {
			t.fail(error);
		}
	});

	test('uniqueClientRegCheck - PUT should throw an error b/c client_id not defined', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				method: 'PUT',
				path: `/${authGroup.id}/reg/${authGroup.associatedClient}`,
				req: {
					params: {
						group: authGroup.id
					}
				},
				request: {
					body: {}
				},
				app: {
					emit: jest.fn()
				}
			};
			const mCl = jest
				.spyOn(cl, 'validateUniqueNameGroup')
				.mockResolvedValue(true);
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.uniqueClientRegCheck(ctx, jest.fn());
			expect(spy).toHaveBeenCalled();
			const args = spy.mock.calls[0];
			expect(args[0].status).toBe(400);
			expect(args[0].body.error).toBe('Bad Request');
			expect(args[0].body.message).toBe('client_id should be included in the request body');
			spy.mockRestore();
			mCl.mockRestore();
		} catch (error) {
			t.fail(error);
		}
	});

	test('uniqueClientRegCheck - PUT should work when client_id is there', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				method: 'PUT',
				path: `/${authGroup.id}/reg/${authGroup.associatedClient}`,
				req: {
					params: {
						group: authGroup.id
					}
				},
				request: {
					body: {
						client_id: authGroup.associatedClient
					}
				},
				app: {
					emit: jest.fn()
				}
			};
			const mCl = jest
				.spyOn(cl, 'validateUniqueNameGroup')
				.mockResolvedValue(true);
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.uniqueClientRegCheck(ctx, jest.fn());
			expect(mCl).toHaveBeenCalled();
			expect(spy).not.toHaveBeenCalled();
			spy.mockRestore();
			mCl.mockRestore();
		} catch (error) {
			t.fail(error);
		}
	});

	test('uniqueClientRegCheck - PUT with client_id but not unique name', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				method: 'PUT',
				path: `/${authGroup.id}/reg/${authGroup.associatedClient}`,
				req: {
					params: {
						group: authGroup.id
					}
				},
				request: {
					body: {
						client_id: authGroup.associatedClient
					}
				},
				app: {
					emit: jest.fn()
				}
			};
			const mCl = jest
				.spyOn(cl, 'validateUniqueNameGroup')
				.mockResolvedValue(false);
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.uniqueClientRegCheck(ctx, jest.fn());
			//expect(ctx.request.body.auth_group).toBe(authGroup.id);
			expect(spy).toHaveBeenCalled();
			expect(mCl).toHaveBeenCalled();
			const args = spy.mock.calls[0];
			expect(args[0].status).toBe(409);
			expect(args[0].body.error).toBe('Conflict');
			expect(args[0].body.message).toBe('This client name already exists in your auth group');
			spy.mockRestore();
			mCl.mockRestore();
		} catch (error) {
			t.fail(error);
		}
	});

	test('koaErrorOut parses Boom and outputs', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				method: 'GET',
				path: `/${authGroup.id}/reg/${authGroup.associatedClient}`,
				req: {
					params: {
						group: authGroup.id
					}
				},
				app: {
					emit: jest.fn()
				}
			};
			await middle.koaErrorOut(ctx, Boom.badRequest('TEST'));
			expect(ctx.app.emit).toHaveBeenCalled();
			const args = ctx.app.emit.mock.calls[0];
			expect(args[0]).toBe('error');
			expect(args[1].isBoom).toBe(true);
			expect(args[1].output).toMatchObject({
				"statusCode": 400,
				"payload": {
					"error": "Bad Request",
					"message": "TEST"
				},
				"headers": {}
			});
		} catch (error) {
			t.fail(error);
		}
	});

	test('koaErrorOut parses standard error and outputs', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				method: 'GET',
				path: `/${authGroup.id}/reg/${authGroup.associatedClient}`,
				req: {
					params: {
						group: authGroup.id
					}
				},
				app: {
					emit: jest.fn()
				}
			};
			await middle.koaErrorOut(ctx, new Error('TEST'));
			expect(ctx.app.emit).toHaveBeenCalled();
			const args = ctx.app.emit.mock.calls[0];
			expect(args[0]).toBe('error');
			expect(args[1].isBoom).toBe(true);
			expect(args[1].output).toMatchObject({
				"statusCode": 500,
				"payload": {
					"error": "Internal Server Error",
					"message": "An internal server error occurred"
				},
				"headers": {}
			});
		} catch (error) {
			t.fail(error);
		}
	});

	test('parseKoaOIDC - ctx.response.body.error = server_error', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				method: 'POST',
				path: `/${authGroup.id}/reg`,
				req: {
					params: {
						group: authGroup.id
					}
				},
				response: {
					message: 'TESTING',
					body: {
						error: 'server_error',
						error_description: 'testing internal server error'
					}
				},
				app: {
					emit: jest.fn()
				}
			};
			const spy = jest.spyOn(errHandler, 'oidcLogger');
			await middle.parseKoaOIDC(ctx, jest.fn());
			const args = spy.mock.calls[0];
			expect(args[0].error).toBe('server_error');
			expect(args[0].message).toBe( 'Unexpected OIDC error. testing internal server error. Work with admin to review Logs');
			expect(args[0].id).toBeDefined();
			spy.mockRestore();
		} catch (error) {
			t.fail(error);
		}
	});

	// this may change after we wrap all error outputs...
	test('parseKoaOIDC - ctx.response.body.error != server_error', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				method: 'POST',
				path: `/${authGroup.id}/reg`,
				req: {
					params: {
						group: authGroup.id
					}
				},
				response: {
					body: {
						error: 'other_error',
						error_description: 'details here'
					}
				},
				app: {
					emit: jest.fn()
				}
			};
			const spy = jest.spyOn(errHandler, 'oidcLogger');
			await middle.parseKoaOIDC(ctx, jest.fn());
			const args = spy.mock.calls[0];
			expect(args[0].error).toBe('other_error');
			expect(args[0].message).toBe('OIDC - details here');
			expect(args[0].id).toBeDefined();
			spy.mockRestore();
		} catch (error) {
			t.fail(error);
		}
	});

	test('parseKoaOIDC - interactions are ok if group and client.auth_group do not match', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				method: 'POST',
				path: `/${authGroup.id}/reg`,
				req: {
					params: {
						group: 'test'
					}
				},
				oidc: {
					entities: {
						Client: {
							auth_group: authGroup.id
						},
						Interaction: {
							kind: 'Interaction'
						}
					}
				},
				response: {
					body: {
						error: 'other_error'
					}
				},
				app: {
					emit: jest.fn()
				}
			};
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.parseKoaOIDC(ctx, jest.fn());
			expect(spy).not.toHaveBeenCalled();
			spy.mockRestore();
		} catch (error) {
			t.fail(error);
		}
	});

	test('parseKoaOIDC - all other transactions error if group and client.auth_group do not match', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				method: 'POST',
				path: `/${authGroup.id}/reg`,
				req: {
					params: {
						group: 'test'
					}
				},
				oidc: {
					entities: {
						Client: {
							auth_group: authGroup.id
						},
						Interaction: {
							kind: 'other'
						}
					}
				},
				response: {
					body: {
						error: 'other_error'
					}
				},
				app: {
					emit: jest.fn()
				}
			};
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.parseKoaOIDC(ctx, jest.fn());
			const args = spy.mock.calls[0];
			expect(args[0].status).toBe(404);
			expect(args[0].body.error).toBe('Not Found');
			expect(args[0].body.message).toBe('auth group not found. try explicitly adding auth_group to the client reg request.');
			spy.mockRestore();
		} catch (error) {
			t.fail(error);
		}
	});

	test('parseKoaOIDC - single use IAT configuration true/false', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', true, false);
			authGroup.id = authGroup._id;
			const ctx = {
				authGroup,
				method: 'POST',
				path: `/${authGroup.id}/reg`,
				req: {
					params: {
						group: authGroup.id
					}
				},
				oidc: {
					entities: {
						Client: {
							auth_group: authGroup.id
						},
						Interaction: {
							kind: 'other'
						},
						InitialAccessToken: {
							jti: cryptoRandomString({length: 21, type: 'url-safe'})
						}
					}
				},
				response: {
					body: {
						error: 'other_error'
					},
					status: 201
				},
				app: {
					emit: jest.fn()
				}
			};
			//IAT.deleteOne.mockResolvedValue(true);
			const mIAT = jest.spyOn(IAT, 'deleteOne')
				.mockResolvedValue(true);
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.parseKoaOIDC(ctx, jest.fn());
			// you can toggle this config by changing your .env.test.SINGLE_USE_AT setting
			if(config.SINGLE_USE_IAT === true) {
				expect(mIAT).toHaveBeenCalledWith(ctx.oidc.entities.InitialAccessToken.jti, ctx.authGroup._id);
			} else {
				expect(mIAT).not.toHaveBeenCalled();
			}
			expect(spy).not.toHaveBeenCalled();
			mIAT.mockRestore();
			spy.mockRestore();
		} catch (error) {
			t.fail(error);
		}
	});
});