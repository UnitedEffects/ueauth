const fs = require('fs');
const env = process.env.NODE_ENV || 'dev';
const dir = (fs.existsSync('./.env')) ? '.env' : '.env_ci';
const envVars = require(`../${dir}/env.${env}`);

const config = {
    ENV: process.env.NODE_ENV || envVars.NODE_ENV || 'dev',
    NAME: process.env.NAME || envVars.NAME || 'Boilerplate Service',
    PROTOCOL: process.env.PROTOCOL || envVars.PROTOCOL || 'http',
    MONGO: process.env.MONGO || envVars.MONGO || 'mongodb://localhost:27017/your-db',
    SWAGGER: process.env.SWAGGER || envVars.SWAGGER || 'localhost:3000',
    REPLICA: process.env.REPLICA || envVars.REPLICA || 'rs0',
    PERSIST_HTTP_ERRORS: process.env.PERSIST_HTTP_ERRORS || envVars.PERSIST_HTTP_ERRORS || false,
    WRITE_LOGS_TO_DB: process.env.WRITE_LOGS_TO_DB || envVars.WRITE_LOGS_TO_DB || false
};

module.exports = config;