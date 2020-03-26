import mongoose from "mongoose";
const config = require('./config');
let i = 0;
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
        }
    },
    replicaCheck(options, replica, env) {
        const out = JSON.parse(JSON.stringify(options));
        if (config.ENV !== env) {
            options.replicaSet = replica;
        }
        return out;
    },
    async create (mongoConnect, replica) {
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
            if(i<20) await connect.create(mongoConnect, replica);
            else {
                console.info('Retry limit for connection attempts hit. Ending process');
                process.exit(1);
            }
        }
    }
};

export default connect;