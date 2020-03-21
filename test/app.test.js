/**
 * Not an exhaustive set of tests for the boilerplate - only the framework for reference
 */

import '@babel/register';
import "regenerator-runtime/runtime";
import Boom from "@hapi/boom";
import request from 'supertest';
import errorHandler from '../src/customErrorHandler';
import app from '../src/app';

describe('Error Handler Tests', () => {
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

describe('API Test', () => {
    it('should return 404', async () => {
        const res = await request(app)
            .get('/api/xyz');
        expect(res.statusCode).toEqual(404);
    })
});

//todo: mongo