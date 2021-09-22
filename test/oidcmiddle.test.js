import '@babel/register';
import 'regenerator-runtime/runtime';
import t from './testhelper';
import middle from '../src/oidcMiddleware';
import errHandler from '../src/customErrorHandler';
import Boom from '@hapi/boom';
import {GroupMocks} from './models';
import Model from '../src/api/authGroup/model';
import cl from '../src/api/oidc/client/clients';
jest.mock('../src/api/oidc/client/clients');
import IAT from '../src/api/oidc/initialAccess/iat';
jest.mock('../src/api/oidc/initialAccess/iat');
const mockingoose = require('mockingoose');
const config = require('../src/config');
const cryptoRandomString = require('crypto-random-string');

import NodeCache from 'node-cache';
jest.mock('node-cache');

describe('OIDC Pre/Post Middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockingoose.resetAll();
        Model.Query.prototype.save.mockClear();
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
			console.info(error);
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
			expect(args[0].status).toBe(428);
			expect(args[0].body.error).toBe('Precondition Required');
			expect(args[0].body.message).toBe('authGroup is required');
		} catch (error) {
			t.fail(error);
		}
	});

	test('validate authgroup for OP koa routes - authgroup not defined - group provided', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', false, false);
			authGroup.id = authGroup._id;
			NodeCache.prototype.get.mockResolvedValue(undefined);
			mockingoose(Model).toReturn(authGroup, 'findOne');
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
			const query = {
				active: true,
				$or: [
					{ _id: ctx.req.params.group },
					{ prettyName: ctx.req.params.group }
				]
			};
			await middle.validateAuthGroup(ctx);
			expect(Model.Query.prototype.findOne).toHaveBeenCalledWith(query, undefined);
			expect(ctx.authGroup.id).toBe(authGroup.id);
			expect(ctx.authGroup.name).toBe(authGroup.name);
			expect(ctx.authGroup.prettyName).toBe(authGroup.prettyName);
			expect(ctx.req.params.group).toBe(authGroup.id);
		} catch (error) {
			t.fail(error);
		}
	});

	test('validate authgroup for OP koa routes - authgroup not defined - group provided - not found', async () => {
		try {
			mockingoose(Model).toReturn(undefined, 'findOne');
			NodeCache.prototype.get.mockResolvedValue(undefined);
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
			const query = {
				active: true,
				$or: [
					{ _id: 'root' },
					{ prettyName: 'root' }
				]
			};
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.validateAuthGroup(ctx);
			expect(Model.Query.prototype.findOne).toHaveBeenCalledWith(query, undefined);
			expect(spy).toHaveBeenCalled();
			const args = spy.mock.calls[0];
			expect(args[0].status).toBe(404);
			expect(args[0].body.error).toBe('Not Found');
			expect(args[0].body.message).toBe('auth group not found');
		} catch (error) {
			t.fail(error);
		}
	});

	test('validate authgroup for OP koa routes - authgroup not defined - group provided and cached', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', false, false);
			authGroup.id = authGroup._id;
			NodeCache.prototype.get.mockResolvedValue(JSON.stringify(authGroup));
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
			expect(NodeCache.prototype.get).toHaveBeenCalled();
			expect(ctx.authGroup.id).toBe(authGroup.id);
			expect(ctx.authGroup.name).toBe(authGroup.name);
			expect(ctx.authGroup.prettyName).toBe(authGroup.prettyName);
			expect(ctx.req.params.group).toBe(authGroup.id);
		} catch (error) {
			t.fail(error);
		}
	});
	/*
	test('validate authgroup for OP koa routes - group provided and cached - cache refresh requested', async () => {
		try {
			const authGroup = GroupMocks.newGroup('UE Core', 'root', false, false);
			authGroup.id = authGroup._id;
			NodeCache.prototype.get.mockResolvedValue(authGroup);
			mockingoose(Model).toReturn(authGroup, 'findOne');
			const ctx = {
				req: {
					params: {
						group: 'root'
					},
					query: {
						resetCache: 'true'
					}
				},
				app: {
					emit: jest.fn()
				}
			};
			const query = {
				active: true,
				$or: [
					{ _id: ctx.req.params.group },
					{ prettyName: ctx.req.params.group }
				]
			};
			await middle.validateAuthGroup(ctx);
			expect(NodeCache.prototype.get).not.toHaveBeenCalled();
			expect(Model.Query.prototype.findOne).toHaveBeenCalledWith(query, undefined);
			expect(ctx.authGroup.id).toBe(authGroup.id);
			expect(ctx.authGroup.name).toBe(authGroup.name);
			expect(ctx.authGroup.prettyName).toBe(authGroup.prettyName);
			expect(ctx.req.params.group).toBe(authGroup.id);
		} catch (error) {
			t.fail(error);
		}
	});

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

	test('uniqueClientRegCheck - POST should add group to the body', async () => {
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
			cl.validateUniqueNameGroup.mockResolvedValue(true);
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.uniqueClientRegCheck(ctx, jest.fn());
			expect(ctx.request.body.auth_group).toBe(authGroup.id);
			expect(spy).not.toHaveBeenCalled();
		} catch (error) {
			t.fail(error);
		}
	});

	test('uniqueClientRegCheck - PUT should add group to the body but throw an error b/c client_id not defined', async () => {
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
			cl.validateUniqueNameGroup.mockResolvedValue(true);
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.uniqueClientRegCheck(ctx, jest.fn());
			expect(ctx.request.body.auth_group).toBe(authGroup.id);
			expect(spy).toHaveBeenCalled();
			const args = spy.mock.calls[0];
			expect(args[0].status).toBe(400);
			expect(args[0].body.error).toBe('Bad Request');
			expect(args[0].body.message).toBe('client_id should be included in the request body');
		} catch (error) {
			t.fail(error);
		}
	});

	test('uniqueClientRegCheck - PUT should add group to the body and work when client_id is there', async () => {
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
			cl.validateUniqueNameGroup.mockResolvedValue(true);
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.uniqueClientRegCheck(ctx, jest.fn());
			expect(ctx.request.body.auth_group).toBe(authGroup.id);
			expect(spy).not.toHaveBeenCalled();
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
			cl.validateUniqueNameGroup.mockResolvedValue(false);
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.uniqueClientRegCheck(ctx, jest.fn());
			expect(ctx.request.body.auth_group).toBe(authGroup.id);
			expect(spy).toHaveBeenCalled();
			const args = spy.mock.calls[0];
			expect(args[0].status).toBe(409);
			expect(args[0].body.error).toBe('Conflict');
			expect(args[0].body.message).toBe('This client name already exists in your auth group');
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
			expect(args[0].body.message).toBe('auth group not found');
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
			IAT.deleteOne.mockResolvedValue(true);
			const spy = jest.spyOn(middle, 'koaErrorOut');
			await middle.parseKoaOIDC(ctx, jest.fn());
			// you can toggle this config by changing your .env.test.SINGLE_USE_AT setting
			if(config.SINGLE_USE_IAT === true) {
				expect(IAT.deleteOne).toHaveBeenCalledWith(ctx.oidc.entities.InitialAccessToken.jti, ctx.authGroup._id);
			}else {
				expect(IAT.deleteOne).not.toHaveBeenCalled();
			}
			expect(spy).not.toHaveBeenCalled();
		} catch (error) {
			t.fail(error);
		}
	});

	 */
});