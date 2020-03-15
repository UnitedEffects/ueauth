import mongoose from "mongoose";
const config = require('./config');
const connect = {
    async create (mongoConnect, replica) {
        try {
            const mongoOptions = {
                keepAlive: 300000,
                connectTimeoutMS: 10000,
                useNewUrlParser: true,
                useUnifiedTopology: true,
                useCreateIndex: true,
                promiseLibrary: Promise,
                replicaSet: null
            };
            if (config.ENV === 'production') mongoOptions.replicaSet = replica;
            console.error('mongo connecting');
            return await mongoose.connect(`${mongoConnect}?authSource=admin`, mongoOptions);
        } catch (err) {
            console.error(`******** DB attempted and failed:  ${mongoConnect} ********`);
            console.error(err);
            console.error('Retrying Connection');
            // todo add a retry limit
            await connect.create(mongoConnect, replica);
        }
    }
};

export default connect;