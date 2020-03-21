import moment from 'moment';
import dal from './dal';
import helper from '../../helper';
const config = require('../../config');

const WRITE_BEHAVIOR = config.WRITE_LOGS_TO_DB;

export default {
    async writeLog(data, write=true) {
        const logData = data;
        if(!logData.logTimestamp) logData.logTimestamp = moment().format();
        if(logData.code) logData.code = data.code.toUpperCase();
        const log = await dal.logObject(logData);
        if (write === true) {
            console.log(JSON.parse(JSON.stringify(log)));
            return dal.writeLogObject(log);
        }
        const out = JSON.parse(JSON.stringify(log));
        out.persisted = false;
        console.log(out);
        return out;
    },

    async getLogs(q) {
        const query = await helper.parseOdataQuery(q);
        return dal.getLogs(query);
    },

    async getLog(id) {
        return dal.getLog(id);
    },

    async record(data, write=WRITE_BEHAVIOR) {
        const logData = {
            logCode: 'HTTP',
            message: 'Error recorded and sent out as http response.',
            details: data
        };
        return this.writeLog(logData, write);
    },

    error(message, write=WRITE_BEHAVIOR) {
        const data = {
            logCode: 'ERROR',
            message: `Caught Error at ${moment().format('LLLL')}. See details.`,
            details: message
        };
        try {
            this.writeLog(data, write);
        } catch (error) {
            console.error(error);
        }
    },

    notify(message, write=WRITE_BEHAVIOR) {
        const data = {
            logCode: 'NOTIFY',
            logTimestamp: moment().format(),
            message: (helper.isJson(message)) ? JSON.stringify(message) : message
        };
        try {
            this.writeLog(data, write);
        } catch (error) {
            console.error(error);
        }
    },

    success(message, write=WRITE_BEHAVIOR) {
        const data = {
            logCode: 'SUCCESS',
            logTimestamp: moment().format(),
            message: (helper.isJson(message)) ? JSON.stringify(message) : message
        };
        try {
            this.writeLog(data, write);
        } catch (error) {
            console.error(error);
        }
    },

    detail(code, message, detail, write=WRITE_BEHAVIOR) {
        const data = {
            logCode: code,
            logTimestamp: moment().format(),
            message: (helper.isJson(message)) ? JSON.stringify(message) : message,
            details: detail
        };
        try {
            this.writeLog(data, write);
        } catch (error) {
            console.error(error);
        }
    }
};