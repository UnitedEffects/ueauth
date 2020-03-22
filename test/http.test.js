/**
 * todo - Testing http 404, root API calls, and health api call
 */
import '@babel/register';
import "regenerator-runtime/runtime";
import request from 'supertest';
import app from '../src/app';

describe('API tests', () => {
    it('should return 404', async () => {
        const res = await request(app)
            .get('/api/xyz');
        expect(res.statusCode).toEqual(404);
    })
});