import Group from './model';

export default {
    async write(data) {
        const group = new Group(data);
        return group.save();
    },
    async get(query) {
        return Group.find(query.query).select(query.projection).sort(query.sort).skip(query.skip).limit(query.limit);
    },
    async getOne(id) {
        return Group.findOne( { _id: id });
    },
    async getOneByEither(q) {
        return Group.findOne({$or: [
                { _id: q },
                { prettyName: q }
            ]});
    },
    async patch(id, data) {
        data.modifiedAt = Date.now();
        return Group.findOneAndUpdate({ _id: id }, data, { new: true, overwrite: true })
    },
    async checkPrettyName(prettyName) {
        return Group.find({ prettyName }).countDocuments();
    }
};