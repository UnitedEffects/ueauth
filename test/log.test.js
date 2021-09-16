import '@babel/register';
import "regenerator-runtime/runtime";
import Model from '../src/api/logging/model';
import log from '../src/api/logging/logs';
const mockingoose = require('mockingoose');
import t from './testhelper';

const oneLog = {
    "logTimestamp": "2020-03-23T02:11:49.000Z",
    "code": "ERROR",
    "message": "TEST",
    "details": {
        "test": "test"
    },
    "_id": "4dd31c2c-be8b-4f96-8d30-40ce1b0a42fb"
};

const multiLogs = [
    {
        "logTimestamp": "2020-03-23T02:11:49.000Z",
        "code": "ERROR",
        "message": "TEST",
        "details": {
            "test": "test"
        },
        "_id": "4dd31c2c-be8b-4f96-8d30-40ce1b0a42fb"
    },
    {
        "logTimestamp": "2020-03-23T02:12:49.000Z",
        "code": "NOTIFY",
        "message": "TEST 2",
        "details": {
            "test": "test 2"
        },
        "_id": "4dd31c2c-be8b-4f96-8d30-40ce1b0a42ec"
    }
];

describe('Log DAL tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockingoose.resetAll();
        Model.Query.prototype.findOne.mockClear();
    });

    it('write a log with persist true', async () => {
        try {
            const expected = JSON.parse(JSON.stringify(oneLog));
            expected.id = expected._id;
            delete expected._id;
            mockingoose(Model).toReturn(oneLog, 'save');
            const data = {
                "code": "ERROR",
                "message": "TEST",
                "details": {
                    "test": "test"
                }
            };
            const result = await log.writeLog(data, true);
            expect(Model.prototype.save).toHaveBeenCalled();
            const res = JSON.parse(JSON.stringify(result));
            expect(res).toMatchObject(expected);
            expect(res.persisted).toBe(true);
        } catch (error) {
            console.error(error);
            t.fail();
        }

    });

    it('write a log with persist false', async () => {
        try {
            const expected = JSON.parse(JSON.stringify(oneLog));
            expected.id = expected._id;
            delete expected._id;
            mockingoose(Model).toReturn(oneLog, 'save');
            const data = {
                "code": "ERROR",
                "message": "TEST",
                "details": {
                    "test": "test"
                }
            };
            const result = await log.writeLog(data, false);
            expect(Model.prototype.save).not.toHaveBeenCalled();
            const res = JSON.parse(JSON.stringify(result));
            expect(res.code).toBe(expected.code);
            expect(res.message).toBe(expected.message);
            expect(res.details).toStrictEqual(expected.details);
        } catch (error) {
            console.error(error);
            t.fail();
        }

    });

    it('get one log', async () => {
        try {
            const expected = JSON.parse(JSON.stringify(oneLog));
            expected.id = expected._id;
            delete expected._id;
            mockingoose(Model).toReturn(oneLog, 'findOne');
            const result = await log.getLog(oneLog._id);
            expect(Model.Query.prototype.findOne).toHaveBeenCalledWith({ "_id": oneLog._id }, undefined);
            const res = JSON.parse(JSON.stringify(result));
            expect(res).toMatchObject(expected);
        } catch (error) {
            console.error(error);
            t.fail();
        }
    });

    it('get logs', async () => {
        try {
            const expected = JSON.parse(JSON.stringify(multiLogs));
            expected[0].id = expected[0]._id;
            expected[1].id = expected[1]._id;
            delete expected[0]._id;
            delete expected[1]._id;
            mockingoose(Model).toReturn(multiLogs, 'find');
            const q = { $filter: "code eq 'ERROR'" };
            const result = await log.getLogs(q);
            expect(Model.Query.prototype.find).toHaveBeenCalledWith({ code: 'ERROR' }, undefined);
            const res = JSON.parse(JSON.stringify(result));
            expect(res).toMatchObject(expected);
        } catch (error) {
            console.error(error);
            t.fail();
        }
    });

    it('record a log', async () => {
        try {
            mockingoose(Model).toReturn({}, 'save');
            const result = await log.record({ info: 'testing http errors'});
            expect(Model.Query.prototype.findOne).not.toHaveBeenCalled();
            const res = JSON.parse(JSON.stringify(result));
            expect(res.code).toBe('ERROR');
            expect(res.message).toBe('Error recorded and sent out as http response.');
            expect(res.details).toStrictEqual({ info: 'testing http errors'});
        } catch (error) {
            console.error(error);
            t.fail();
        }
    });

});