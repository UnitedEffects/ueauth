import mongoose from "mongoose";
const config = require('./config');
const connect = {
    connectOptions () {
        return {
            keepAlive: 300000,
            connectTimeoutMS: 10000,
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false,
            useCreateIndex: true,
            promiseLibrary: Promise,
            replicaSet: null
        }
    },
    replicaCheck(options, replica, env) {
        if (config.ENV === env) {
            options.replicaSet = replica;
        }
        return options;
    },
    async create (mongoConnect, replica) {
        try {
            let mongoOptions = this.connectOptions();
            mongoOptions = this.replicaCheck(mongoOptions, replica, 'production');
            console.info(mongoOptions);
            console.error('mongo connecting');
            return await mongoose.connect(`${mongoConnect}?authSource=admin`, mongoOptions);
        } catch (err) {
            console.error(`******** DB attempted and failed:  ${mongoConnect} ********`);
            console.error(err);
            console.error('Retrying Connection');
            // may want to add retry limit
            await connect.create(mongoConnect, replica);
        }
    }
};

export default connect;