const fs = require('fs');
const env = process.env.NODE_ENV || 'dev';
const dir = (fs.existsSync('./.env')) ? '.env' : '.env_ci';
const envVars = require(`../${dir}/env.${env}`);

const config = {
    ENV: process.env.NODE_ENV || envVars.NODE_ENV || 'dev',
    PROTOCOL: process.env.PROTOCOL || envVars.PROTOCOL || 'http',
    IMPLEMENTER: process.env.IMPLEMENTER || envVars.IMPLEMENTER || 'theBoEffect',
    MONGO: process.env.MONGO || envVars.MONGO || 'mongodb://localhost:27017/your-db',
    SWAGGER: process.env.SWAGGER || envVars.SWAGGER || 'localhost:3000',
    REPLICA: process.env.REPLICA || envVars.REPLICA || 'rs0',
    PERSIST_HTTP_ERRORS: process.env.PERSIST_HTTP_ERRORS || envVars.PERSIST_HTTP_ERRORS || false,
    /**
     * The Below can be delete, it is for legacy functionality in United Effects
     */
    UEAUTH: {
        TOKENURL: process.env.UE_TOKENURL || envVars.UE_TOKENURL,
        PRODUCT_SLUG: process.env.UE_PRODUCT_SLUG || envVars.UE_PRODUCT_SLUG,
        WEBHOOK: process.env.UE_WEBHOOK || envVars.UE_WEBHOOK
    }
};

module.exports = config;