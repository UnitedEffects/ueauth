import Log from './model';

export default {
    async logObject(data) {
        return new Log(data);
    },
    async writeLogObject(logObject) {
        return logObject.save();
    },
    async writeLog(data) {
        const log = this.logObject(data);
        return this.writeLogObject(log);
    },
    async getLogs(query) {
        return Log.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
    },
    async getLog(id) {
        return Log.findOne( { _id: id });
    },
    async patchLog(id, data) {
        return Log.findOneAndUpdate({ _id: id }, data, { new: true, overwrite: true })
    }
};