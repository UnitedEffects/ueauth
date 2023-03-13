const sls = require('serverless-http');
const app = require('./app').default;
const connection = require('./connection').default;
const config = require('./config');

let mongoConnect = config.MONGO;

if (!mongoConnect) {
	console.error('Mongo Connection not set. Exiting.');
	process.exit(1);
}

if(process.env.NODE_ENV === 'dev') console.info(`Connection string: ${mongoConnect}`);
connection.create(mongoConnect);

function normalizePort(val) {
	const port = parseInt(val, 10);

	if (isNaN(port)) {
		// named pipe
		return val;
	}

	if (port >= 0) {
		// port number
		return port;
	}

	return false;
}

const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

const handler = sls(app, {
	request: (req, event, context) => {
		req.requestId = context.awsRequestId;
	}
});
module.exports.handler = async (event, context) => {
	// eslint-disable-next-line no-console
	console.log(`START GATEWAY REQUEST: ${event.requestContext.requestId}`);
	const result = await handler(event, context);
	// eslint-disable-next-line no-console
	console.log(`END GATEWAY REQUEST: ${event.requestContext.requestId}`);
	return result;
};