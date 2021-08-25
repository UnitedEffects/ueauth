import '@babel/register';
import "regenerator-runtime/runtime";
import request from 'supertest';
import app from '../src/app';
import swagger from "../src/swagger";
import t from './testhelper';
import Group from '../src/api/authGroup/model';
import Model from "../src/api/logging/model";
const config = require('../src/config');
const pJson = require('../package');
const mockingoose = require('mockingoose');

const authGroupMock = {
    "config": {
        "requireVerified": false,
        "autoVerify": false,
        "passwordLessSupport": false
    },
    "pluginOptions": {
        "notification": {
            "customService": {
                "enabled": false
            },
            "enabled": false,
            "ackRequiredOnOptional": false
        }
    },
    "createdAt": "2021-08-23T15:51:18.626Z",
    "modifiedAt": "2021-08-23T15:51:43.988Z",
    "modifiedBy": "fe031227-e90b-444b-81cb-29bfc2b64810",
    "locked": true,
    "name": "root",
    "prettyName": "root",
    "primaryDomain": "https://unitedeffects.com",
    "primaryTOS": "https://unitedeffects.com/tos",
    "primaryPrivacyPolicy": "https://unitedeffects.com/privacy",
    "associatedClient": "42ce0392-4cda-46ff-9514-acb8b0bdf635",
    "_id": "X2lgt285uWdzq5kKOdAOj"
}

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
            t.fail();
        }

    });

    it('should parse and returns swagger as json', async () => {
        try {
            const swag = JSON.parse(JSON.stringify(swagger));
            swag.info.version = pJson.version;
            swag.info.title = pJson.name;
            swag.info['x-logo'].url = pJson.logo;
            if (config.SWAGGER) swag.servers = [{url: `${config.PROTOCOL}://${config.SWAGGER}`}];
            const res = await request(app)
                .get('/swagger.json');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toStrictEqual(swag);
        } catch (error) {
            console.error(error);
            t.fail();
        }
    });

    it('should parse and returns swagger as json with authgroup specified', async () => {
        try {
            mockingoose(Group).toReturn(authGroupMock, 'findOne');
            let swag = JSON.parse(JSON.stringify(swagger));
            swag.info.version = pJson.version;
            swag.info.title = pJson.name;
            swag.info.description = `<h3>AuthGroup and OIDC security set to: root</h3><p><i>Please note, you will still need to enter a value into the required group fields to make openapi requests; however, for your convenience, the ID of the authgroup you've selected, <strong>root - X2lgt285uWdzq5kKOdAOj</strong>, is displayed and used rather than whatever you may enter in the field.</i></p>${swag.info.description}`;
            swag.info['x-logo'].url = pJson.logo;
            if (config.SWAGGER) swag.servers = [{url: `${config.PROTOCOL}://${config.SWAGGER}`}];
            swag.components.securitySchemes.openId.openIdConnectUrl = `${config.PROTOCOL}://${config.SWAGGER}/X2lgt285uWdzq5kKOdAOj/.well-known/openid-configuration`
            let temp = JSON.stringify(swag);
            temp = temp.replace(/{group}/g, 'X2lgt285uWdzq5kKOdAOj');
            swag = JSON.parse(temp);
            const res = await request(app)
                .get('/root/swagger.json');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toStrictEqual(swag);
        } catch (error) {
            console.error(error);
            t.fail();
        }
    });

    it('health should work', async () => {
        try {
            const res = await request(app)
                .get('/api/health');
            expect(res.statusCode).toEqual(200);
            expect(res.body.server).toStrictEqual('running');
        } catch (error) {
            console.error(error);
            t.fail();
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
                    copyright: `Copyright (c) ${date.getFullYear()} United Effects LLC`
                }
            });
        } catch (error) {
            console.error(error);
            t.fail();
        }
    });
});