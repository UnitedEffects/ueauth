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
    async getOneByEither(q, onlyIncludeActive=true) {
        const query = {
            $or: [
                { _id: q },
                { prettyName: q }
            ]};
        if(onlyIncludeActive === true) query.active = true;
        return Group.findOne(query);
    },
    async patch(id, data) {
        data.modifiedAt = Date.now();
        const updated = await Group.findOneAndUpdate({ _id: id, active: true }, data, { new: true, overwrite: true });
        return updated;
    },
    async activatePatch(id, data) {
        data.modifiedAt = Date.now();
        return Group.findOneAndUpdate({ _id: id, active: false }, data, { new: true, overwrite: true });
    },
    async checkPrettyName(prettyName) {
        return Group.find({ prettyName }).countDocuments();
    },
    async deleteOne(id) {
        return Group.findOneAndRemove({ _id: id, active: false });
    }
};