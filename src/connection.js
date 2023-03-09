import mongoose from 'mongoose';

const config = require('./config');

let i = 0;
const connect = {
	connectOptions() {
		return {
			keepAlive: true,
			connectTimeoutMS: 10000,
			useNewUrlParser: true,
			useUnifiedTopology: true
		};
	},

	async create(mongoConnect) {
		try {
			mongoose.set('strictQuery', true);
			let mongoOptions = this.connectOptions();
			console.error(`mongo connecting - try: ${i}`);
			i++;
			await mongoose.connect(`${mongoConnect}?authSource=admin`, mongoOptions);
			return console.info('connected');
		} catch (err) {
			console.error(`******** DB attempted and failed:  ${mongoConnect} ********`);
			console.error(err);
			console.error('Retrying Connection');
			if (i < 20) return connect.create(mongoConnect);
			console.info('Retry limit for connection attempts hit. Ending process');
			return process.exit(1);
		}
	},
	onConnect (func) {
		if(typeof func !== 'function') {
			console.info('not a function');
			return process.exit(1);
		}
		mongoose.connection.on('connected', func);
	}
};


export default connect;
