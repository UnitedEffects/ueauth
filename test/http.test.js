import '@babel/register';
import "regenerator-runtime/runtime";
import request from 'supertest';
import app from '../src/app';
import swagger from "../src/swagger";
const config = require('../src/config');
const pJson = require('../package');

describe('API tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 404', async () => {
        try {
            const res = await request(app)
                .get('/api/xyz');
            expect(res.statusCode).toEqual(404);
        } catch (error) {
            console.error(error);
            fail();
        }

    });

    it('should parse and returns swagger as json', async () => {
        try {
            const swag = swagger;
            swag.info.version = pJson.version;
            swag.info.title = pJson.name;
            swag.info.description = `${pJson.description} by: <a href="${pJson.url}">${pJson.author}</a>`;
            swag.info['x-logo'].url = pJson.logo;
            if (config.SWAGGER) swag.servers = [{url: `${config.PROTOCOL}://${config.SWAGGER}/api`}];
            const res = await request(app)
                .get('/swagger.json');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toStrictEqual(swag);
        } catch (error) {
            console.error(error);
            fail();
        }
    });

    it('health should work', async () => {
        try {
            const res = await request(app)
                .get('/api/health');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toStrictEqual({data: {server: 'running'}});
        } catch (error) {
            console.error(error);
            fail();
        }
    });

    it('version should work', async () => {
        try {
            const res = await request(app)
                .get('/api/version');
            expect(res.statusCode).toEqual(200);
            const date = new Date();
            expect(res.body).toStrictEqual({
                data: {
                    api: pJson.name,
                    version: pJson.version,
                    baseURL: '/api',
                    copyright: `Copyright (c) ${date.getFullYear()} United Effects LLC`
                }
            });
        } catch (error) {
            console.error(error);
            fail();
        }
    });
});