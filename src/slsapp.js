const sls = require('serverless-http');
const app = require('./app').default;
const connection = require('./connection').default;
const config = require('./config');

let mongoConnect = config.MONGO;

if (!mongoConnect) {
    console.error('Mongo Connection not set. Exiting.');
    process.exit(1);
}

console.info(`Connection string: ${mongoConnect}`);
connection.create(mongoConnect, config.REPLICA);

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


module.exports.handler = sls(app);