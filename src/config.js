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
	ROOT_GROUP_REGISTRATION_UI_URL: process.env.ROOT_GROUP_REGISTRATION_UI_URL || envVars.ROOT_GROUP_REGISTRATION_UI_URL || undefined,
	REPLICA: process.env.REPLICA || envVars.REPLICA || 'rs0',
	PERSIST_HTTP_ERRORS: (process.env.PERSIST_HTTP_ERRORS === 'true') || envVars.PERSIST_HTTP_ERRORS || false,
	WRITE_LOGS_TO_DB: (process.env.WRITE_LOGS_TO_DB === 'true') || envVars.WRITE_LOGS_TO_DB || false,
	SINGLE_USE_IAT: (process.env.SINGLE_USE_IAT === 'true') || envVars.SINGLE_USE_IAT || false,
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
	FULL_SUPER_CONTROL: (process.env.FULL_SUPER_CONTROL === 'true') || envVars.FULL_SUPER_CONTROL || false,
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
			return [];
		} catch (error) {
			console.error(error);
			return [];
		}
	},
	// if you wish to serve static assets locally, add the appropriate files to ./public and change this to "/"
	STATIC_ASSETS: process.env.STATIC_ASSETS || envVars.STATIC_ASSETS || 'https://assets.uecore.io/ueauth/',
	CUSTOM_FONTS_URL: process.env.CUSTOM_FONTS_URL || envVars.CUSTOM_FONTS_URL || undefined,
	// UI SKIN
	DEFAULT_UI_SKIN_SPLASH: process.env.DEFAULT_UI_SKIN_SPLASH || envVars.DEFAULT_UI_SKIN_SPLASH || "https://assets.uecore.io/ueauth/img/default-splash-test.png",
	DEFAULT_UI_SKIN_GRADIENT_LOW: process.env.DEFAULT_UI_SKIN_GRADIENT_LOW || envVars.DEFAULT_UI_SKIN_GRADIENT_LOW || "#131525",
	DEFAULT_UI_SKIN_GRADIENT_HIGH: process.env.DEFAULT_UI_SKIN_GRADIENT_HIGH || envVars.DEFAULT_UI_SKIN_GRADIENT_HIGH || "#1D2035",
	EVENT_EMITTER_CLEAN_SENSITIVE: (process.env.EVENT_EMITTER_CLEAN_SENSITIVE === 'true') || envVars.EVENT_EMITTER_CLEAN_SENSITIVE || false,
	EVENT_EMITTER: {
		general: true,
		accessToken: true,
		authorization: true,
		backchannel: true,
		clientCredentials: true,
		deviceCode: true,
		session: true,
		grant: true,
		iat: true,
		uiInteraction: true,
		replayDetection: true,
		pushedAuthorization: true,
		refreshToken: true,
		registration: true,
		account: true,
		group: true,
		invite: true,
		pluginNotification: true,
		organization: true,
		domain: true
	}
};

module.exports = config;