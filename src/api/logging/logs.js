import moment from 'moment';
import Log from './model';
import helper from '../../helper';

export default {
    async writeLog(data, write=true) {
        const logData = data;
        if(!logData.logTimestamp) logData.logTimestamp = moment().format();
        logData.logCode = data.logCode.toUpperCase();
        const log = new Log(logData);
        if (write === true) {
            console.log(log);
            return log.save();
        }
        return console.log(log);
    },

    async getLogs(query) {
        return Log.find(query).sort('-logTimestamp');
    },

    async getLog(id) {
        return Log.findOne( { id });
    },

    async record(data, write=false) {
        const logData = {
            logCode: 'HTTP',
            message: 'Error recorded and sent out as http response.',
            details: data
        };
        return this.writeLog(logData, write);
    },

    error(message, write=true) {
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

    notify(message, write=false) {
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

    success(message, write=false) {
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

    detail(code, message, detail, write=true) {
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