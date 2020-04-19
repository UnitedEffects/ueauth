import '@babel/register';
import "regenerator-runtime/runtime";
import Boom from "@hapi/boom";
import ref from 'json-schema-ref-parser';
import merge from 'json-schema-resolve-allof';
import yaml from 'yamljs';
import fs from 'fs';
import { OpenApiValidator } from 'express-openapi-validate';
jest.mock('express-openapi-validate');

import swag from '../src/swagger';
import errorHandler from '../src/customErrorHandler';
import m from '../src/middleware';
import helper from '../src/helper';
import connect from "../src/connection";

describe('Error handler tests', () => {
    test('make sure error handler returns 404', async () => {
        try {
            let response = errorHandler.catch404();
            expect(response.isBoom).toBe(true);
            expect(response.output.statusCode).toBe(404);
            expect(response.output.payload.statusCode).toBe(404);
        } catch (error) {
            console.info(error);
            fail();
        }

    });

    test('make sure error parser works with system error', async () => {
        try {
            let response = await errorHandler.parse(new Error('Something strange in the neighborhood'));
            expect(response.statusCode).toBe(500);
        } catch (error) {
            console.info(error);
            fail();
        }

    });

    test('make sure error parser works with Boom 400 error', async () => {
        try {
            let response = await errorHandler.parse(Boom.badRequest('This is a test'));
            expect(response.statusCode).toBe(400);
        } catch (error) {
            console.info(error);
            fail();
        }
    });
});

describe('Middleware tests', () => {
    test('make sure cors headers are set', async () => {
        try {
            const req = {}, res = { sendStatus: jest.fn(), header: jest.fn() }, next = jest.fn();
            await m.cores(req, res, next);
            expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
            expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, HEAD, POST, DELETE, PUT, PATCH, OPTIONS');
            expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, api_key, Authorization');
            expect(next).toHaveBeenCalled();
        } catch (error) {
            console.info(error);
            fail();
        }
    });

    test('make sure catch404 middleware works', async () => {
        try {
            const req = {}, res = { sendStatus: jest.fn(), header: jest.fn() }, next = jest.fn();
            await m.catch404(req, res, next);
            expect(next).toHaveBeenCalledWith(Boom.notFound('Resource not found'));
        } catch (error) {
            console.info(error);
            fail();
        }
    });

    test('make sure catchError response works', async () => {
        try {
            const err = Boom.badRequest('This is a test'), req = {}, res = { respond: jest.fn(), header: jest.fn() }, next = jest.fn();
            await m.catchErrors(err, req, res, next);
            const expected = {
                error: "Bad Request",
                id: expect.any(String),
                message: "This is a test",
                statusCode: 400,
            };
            expect(res.respond).toHaveBeenCalledWith(expected);
        } catch (error) {
            console.info(error);
            fail();
        }
    });

    test('make sure schemaChecker works as expected', async () => {
        try {
            const req = { route: { path: '/logs/:id' }, params: ['id'], method: 'get' }, res = { respond: jest.fn() }, next = jest.fn();
            await m.schemaCheck(req, res, next);
            expect(OpenApiValidator).toHaveBeenCalledWith(swag);
            expect(next).toHaveBeenCalled();
        } catch (error) {
            console.info(error);
            fail();
        }
    });

    test('make sure schemaChecker works as expected - with issue', async () => {
        try {
            const req = { route: { path: '/logs/:tid' }, params: ['tid'], method: 'get' }, res = { respond: jest.fn() }, next = jest.fn();
            await m.schemaCheck(req, res, next);
            expect(OpenApiValidator).toHaveBeenCalledWith(swag);
            expect(next).toHaveBeenCalledWith(Error('OpenAPI Schema Validation'));
        } catch (error) {
            console.info(error);
            fail();
        }
    });
});

describe('Swagger / OpenAPI parser test', () => {
    test('make sure swagger.js returns contents correctly based on swagger.yaml', async () => {
        try {
            const raw = yaml.parse(fs.readFileSync('./swagger.yaml', 'utf8'));
            const doc = await merge(await ref.dereference(raw));
            expect(swag).toStrictEqual(doc);
        } catch (error) {
            console.info(error);
            fail();
        }
    });
});

describe('Helper tests', () => {
    test('isJson returns true when a string is passed that is infact valid JSON', async () => {
        try {
            const valid = helper.isJson(JSON.stringify({ test: 'ok' }));
            expect(valid).toBe(true);
            const invalid = helper.isJson('{test:ok}');
            expect(invalid).toBe(false);
        } catch (error) {
            console.info(error);
            fail();
        }
    });

    test('elementExists works as expected', async () => {
        try {
            const valid = helper.elementExists('test', 'ok', [{ test: 'ok'}]);
            expect(valid).toBe(true);
            const invalid = helper.elementExists('test', 'oks', [{ test: 'ok'}]);
            expect(invalid).toBe(false);
        } catch (error) {
            console.info(error);
            fail();
        }
    });

    test('oData parser returns an object ready for use by mongo dal', async () => {
        try {
            const query = {
                $filter: 'count eq 2',
                $select: 'x',
                $skip: 2,
                $top: 1,
                $orderby: 'timestamp desc'
            };
            const result = await helper.parseOdataQuery(query);
            expect(result.query).toStrictEqual({ "count": 2 });
            expect(result.sort).toStrictEqual({ "timestamp": -1 });
            expect(result.projection).toStrictEqual({ "x": 1 });
            expect(result.includes).toStrictEqual([]);
            expect(result.skip).toStrictEqual(2);
            expect(result.limit).toStrictEqual(1);
        } catch (error) {
            console.info(error);
            fail();
        }
    });

    test('oData parser returns error with bad data', async () => {
        try {
            const query = {
                $filter: 'count eq 2',
                $select: 'x',
                $skip: 2,
                $top: 1,
                $orderby: 'timestamp dsc'
            };
            await helper.parseOdataQuery(query);
            fail();
        } catch (error) {
            expect(error.isBoom).toBe(true);
            expect(error.output.statusCode).toBe(400);
            expect(error.output.payload.statusCode).toBe(400);
            expect(error.output.payload.message).toBe('Check your oData inputs');
        }
    });
});

describe('Test connectjs', () => {
    test('ensure mongoose options are correct', async () => {
        try {
            const mongoOptions = {
                keepAlive: 300000,
                connectTimeoutMS: 10000,
                useNewUrlParser: true,
                useUnifiedTopology: true,
                useFindAndModify: false,
                useCreateIndex: true,
                promiseLibrary: Promise
            };
            const result = connect.connectOptions();
            expect(result).toStrictEqual(mongoOptions);
        } catch (error) {
            console.info(error);
            fail();
        }
    });

    test('ensure replica set is set depending on configured envirnment - should see it', async () => {
        try {
            const mongoOptions = {
                keepAlive: 300000,
                connectTimeoutMS: 10000,
                useNewUrlParser: true,
                useUnifiedTopology: true,
                useFindAndModify: false,
                useCreateIndex: true,
                promiseLibrary: Promise
            };

            const copy = {
                keepAlive: 300000,
                connectTimeoutMS: 10000,
                useNewUrlParser: true,
                useUnifiedTopology: true,
                useFindAndModify: false,
                useCreateIndex: true,
                promiseLibrary: Promise,
                replicaSet: 'rs0'
            };

            const result = connect.replicaCheck(mongoOptions, 'rs0', `${process.env.NODE_ENV}x`);
            expect(result).toStrictEqual(copy);
        } catch (error) {
            console.info(error);
            fail();
        }
    });

    test('ensure replica set is set depending on configured envirnment - should not see it', async () => {
        try {
            const mongoOptions = {
                keepAlive: 300000,
                connectTimeoutMS: 10000,
                useNewUrlParser: true,
                useUnifiedTopology: true,
                useFindAndModify: false,
                useCreateIndex: true,
                promiseLibrary: Promise
            };

            const copy = {
                keepAlive: 300000,
                connectTimeoutMS: 10000,
                useNewUrlParser: true,
                useUnifiedTopology: true,
                useFindAndModify: false,
                useCreateIndex: true,
                promiseLibrary: Promise,
            };

            const result = connect.replicaCheck(mongoOptions, 'rs0', process.env.NODE_ENV);
            expect(result).toStrictEqual(copy);
        } catch (error) {
            console.info(error);
            fail();
        }
    });
});