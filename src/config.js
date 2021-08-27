const fs = require('fs');
const env = process.env.NODE_ENV || 'dev';
const dir = (fs.existsSync('./.env')) ? '.env' : '.env_ci';
const envVars = require(`../${dir}/env.${env}`);

const config = {
	ENV: process.env.NODE_ENV || envVars.NODE_ENV || 'dev',
	PROTOCOL: process.env.PROTOCOL || envVars.PROTOCOL || 'http',
	MONGO: process.env.MONGO || envVars.MONGO || 'mongodb://localhost:27017/your-db',
	SWAGGER: process.env.SWAGGER || envVars.SWAGGER || 'localhost:3000',
	UI_URL: process.env.UI_URL || envVars.UI_URL || 'example.com',
	REPLICA: process.env.REPLICA || envVars.REPLICA || 'rs0',
	PERSIST_HTTP_ERRORS: process.env.PERSIST_HTTP_ERRORS || envVars.PERSIST_HTTP_ERRORS || false,
	WRITE_LOGS_TO_DB: process.env.WRITE_LOGS_TO_DB || envVars.WRITE_LOGS_TO_DB || false,
	SINGLE_USE_IAT: process.env.SINGLE_USE_IAT || envVars.SINGLE_USE_IAT || true,
	GROUP_SECURE_EXPIRES: parseInt(process.env.GROUP_SECURE_EXPIRES) || envVars.GROUP_SECURE_EXPIRES || 86400 * 31,
	COOKIE_KEYS () {
		try {
			if (process.env.COOKIE_KEYS) return process.env.COOKIE_KEYS.toString().split(',');
			if (envVars.COOKIE_KEYS) return envVars.COOKIE_KEYS.toString().split(',');
			return ['secret1', 'secret2'];
		} catch (error) {
			console.error(error);
			return [];
		}
	},
	ALLOW_ROOT_CREATION: (process.env.ALLOW_ROOT_CREATION === 'true') || envVars.ALLOW_ROOT_CREATION || false,
	ROOT_EMAIL: process.env.ROOT_EMAIL || envVars.ROOT_EMAIL || null,
	ONE_TIME_PERSONAL_ROOT_CREATION_KEY: process.env.ONE_TIME_PERSONAL_ROOT_CREATION_KEY || envVars.ONE_TIME_PERSONAL_ROOT_CREATION_KEY || null,
	FULL_SUPER_CONTROL: (process.env.FULL_SUPER_CONTROL === 'true') || envVars.FULL_SUPER_CONTROL || true,
	OPEN_GROUP_REG: (process.env.OPEN_GROUP_REG === 'true') || envVars.OPEN_GROUP_REG || false,
	ROOT_COMPANY_NAME: process.env.ROOT_COMPANY_NAME || envVars.ROOT_COMPANY_NAME || 'United Effects',
	INIT_ROOT_PRIMARY_DOMAIN: process.env.INIT_ROOT_PRIMARY_DOMAIN || envVars.INIT_ROOT_PRIMARY_DOMAIN || 'https://unitedeffects.com',
	INIT_ROOT_PRIMARY_TOS: process.env.INIT_ROOT_PRIMARY_TOS || envVars.INIT_ROOT_PRIMARY_TOS || 'https://unitedeffects.com/tos',
	INIT_ROOT_PRIMARY_POLICY: process.env.INIT_ROOT_PRIMARY_POLICY || envVars.INIT_ROOT_PRIMARY_POLICY || 'https://unitedeffects.com/privacy',
	PLATFORM_NAME: process.env.PLATFORM_NAME || envVars.PLATFORM_NAME || 'UE Auth',
	UI_WHITE_LIST () {
		try {
			if(process.env.UI_WHITE_LIST) return process.env.UI_WHITE_LIST.toString().split(',');
			if(envVars.UI_WHITE_LIST) return envVars.UI_WHITE_LIST.toString().split(',');
			return ['localhost'];
		} catch (error) {
			console.error(error);
			return [];
		}
	},
	UI_CORE_AUDIENCE_ORIGIN: process.env.UI_CORE_AUDIENCE_ORIGIN || envVars.UI_CORE_AUDIENCE_ORIGIN || 'http://localhost:3000',
	CORE_SCOPES () {
		try {
			if(process.env.CORE_SCOPES) return process.env.CORE_SCOPES.toString().split(',');
			if(envVars.CORE_SCOPES) return envVars.CORE_SCOPES.toString().split(',');
			return []
		} catch (error) {
			console.error(error);
			return [];
		}
	}
};

module.exports = config;