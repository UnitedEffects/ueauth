import mongoose from 'mongoose';

const config = require('./config');

let i = 0;
const connect = {
    connectOptions() {
        return {
            keepAlive: 300000,
            connectTimeoutMS: 10000,
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false,
            useCreateIndex: true,
            promiseLibrary: Promise,
        };
    },
    replicaCheck(options, replica, env) {
        if (config.ENV !== env) {
            options.replicaSet = replica;
        }
        return options;
    },
    async create(mongoConnect, replica) {
        try {
            let mongoOptions = this.connectOptions();
            mongoOptions = this.replicaCheck(mongoOptions, replica, 'dev');
            console.error(`mongo connecting - try: ${i}`);
            i++;
            await mongoose.connect(`${mongoConnect}?authSource=admin`, mongoOptions);
            return console.info('connected');
        } catch (err) {
            console.error(`******** DB attempted and failed:  ${mongoConnect} ********`);
            console.error(err);
            console.error('Retrying Connection');
            if (i < 20) return connect.create(mongoConnect, replica);
            console.info('Retry limit for connection attempts hit. Ending process');
            return process.exit(1);
        }
    }
};

export default connect;
