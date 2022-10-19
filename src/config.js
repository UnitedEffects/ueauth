const fs = require('fs');
const env = process.env.NODE_ENV || 'dev';
const dir = (fs.existsSync('./.env')) ? '.env' : '.env_ci';
const envVars = require(`../${dir}/env.${env}`);

const p = require('../package.json');

const config = {
	// Simple assignment of the current environment: test, dev, qa, production, etc...
	ENV: process.env.NODE_ENV || envVars.NODE_ENV || 'dev',
	VERSION: p.version,
	// Protocol for the deployed service: https vs http
	PROTOCOL: process.env.PROTOCOL || envVars.PROTOCOL || 'http',
	// Mongo connection string. Highly recommend this be encrypted as a secret in any deployment
	MONGO: process.env.MONGO || envVars.MONGO || 'mongodb://localhost:27017/your-db',
	// Mongo Replica Set value (if applicable)
	REPLICA: process.env.REPLICA || envVars.REPLICA || 'rs0',
	// Self reference so that Swagger UI knows where to make requests. Used elsewhere as a convenient reference to service host domain
	SWAGGER: process.env.SWAGGER || envVars.SWAGGER || 'localhost:3000',
	// Reference to where the UI is hosted. This repo is just the backend witch central OIDC UI screen.
	UI_URL: process.env.UI_URL || envVars.UI_URL || 'example.com',
	// Reference to where the UI redirect URL should go after logout for AuthGroup access to the UI
	UI_LOGIN_REDIRECT_PATH: process.env.UI_LOGIN_REDIRECT_PATH || envVars.UI_LOGIN_REDIRECT_PATH || '/signin',
	// Reference to where the UI redirect URL should go for AuthGroup access to the UI
	UI_LOGOUT_REDIRECT_PATH: process.env.UI_LOGOUT_REDIRECT_PATH || envVars.UI_LOGOUT_REDIRECT_PATH || '/signout',
	// Reference to where the UI redirect for token refresh should go for AuthGroup access to the UI
	UI_REFRESH_REDIRECT_PATH: process.env.UI_REFRESH_REDIRECT_PATH || envVars.UI_REFRESH_REDIRECT_PATH || '/silentrenew',
	// Reference to where users should be linked when they need to complete a registration (optional)
	ROOT_GROUP_REGISTRATION_UI_URL: process.env.ROOT_GROUP_REGISTRATION_UI_URL || envVars.ROOT_GROUP_REGISTRATION_UI_URL || undefined,
	// This service can persist http errors in mongo logs. Not recommended for production
	PERSIST_HTTP_ERRORS: (process.env.PERSIST_HTTP_ERRORS === 'true') || envVars.PERSIST_HTTP_ERRORS || false,
	// This service can persist unexpected error logs to mongo. Not recommended for production
	WRITE_LOGS_TO_DB: (process.env.WRITE_LOGS_TO_DB === 'true') || envVars.WRITE_LOGS_TO_DB || false,
	// When set to true, this ensures that any Initial Access Token being used is deleted after the first attempt, even if attempt fails
	SINGLE_USE_IAT: (process.env.SINGLE_USE_IAT === 'true') || envVars.SINGLE_USE_IAT || false,
	// When registering a new AuthGroup, there is an expiration window to activate that AuthGroup
	GROUP_SECURE_EXPIRES: parseInt(process.env.GROUP_SECURE_EXPIRES) || envVars.GROUP_SECURE_EXPIRES || 86400 * 31,
	// OIDC uses cookies to manage local sessions for users. COOKIE_KEYS provides the encryption keys
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
	// When true and when Root does not yet exist, a user can request to initialize UE Auth with a Root AuthGroup
	ALLOW_ROOT_CREATION: (process.env.ALLOW_ROOT_CREATION === 'true') || envVars.ALLOW_ROOT_CREATION || false,
	// As a backup to the database limit of only one Root AuthGroup, creation of the Root AuthGroup requires a creation key. It is recommended that this be set to null, empty string, or undefined unless you are actively creating a Root AuthGroup
	ONE_TIME_PERSONAL_ROOT_CREATION_KEY: process.env.ONE_TIME_PERSONAL_ROOT_CREATION_KEY || envVars.ONE_TIME_PERSONAL_ROOT_CREATION_KEY || null,
	// The email address to be used when creating the Root AuthGroup. A user Account will be generated with this email address.
	ROOT_EMAIL: process.env.ROOT_EMAIL || envVars.ROOT_EMAIL || null,
	// The Root AuthGroup has super admin across all accounts, organizations and domains. When set to false, that control is limited to read across all rather than the ability to update data on some sensative objects.
	FULL_SUPER_CONTROL: (process.env.FULL_SUPER_CONTROL === 'true') || envVars.FULL_SUPER_CONTROL || false,
	// When OPEN_GROUP_REG is true, anyone can sign up for an AuthGroup. Otherwise only Root users can
	OPEN_GROUP_REG: (process.env.OPEN_GROUP_REG === 'true') || envVars.OPEN_GROUP_REG || false,
	// Company name for the Root AuthGroup
	ROOT_COMPANY_NAME: process.env.ROOT_COMPANY_NAME || envVars.ROOT_COMPANY_NAME || 'United Effects',
	// Company URL for the Root AuthGroup
	INIT_ROOT_PRIMARY_DOMAIN: process.env.INIT_ROOT_PRIMARY_DOMAIN || envVars.INIT_ROOT_PRIMARY_DOMAIN || 'https://unitedeffects.com',
	// Terms of Service URL for the Root AuthGroup
	INIT_ROOT_PRIMARY_TOS: process.env.INIT_ROOT_PRIMARY_TOS || envVars.INIT_ROOT_PRIMARY_TOS || 'https://unitedeffects.com/tos',
	// Privacy Policy URL for the Root AuthGroup
	INIT_ROOT_PRIMARY_POLICY: process.env.INIT_ROOT_PRIMARY_POLICY || envVars.INIT_ROOT_PRIMARY_POLICY || 'https://unitedeffects.com/privacy',
	// Customize the displayed name of the UE Auth Platform
	PLATFORM_NAME: process.env.PLATFORM_NAME || envVars.PLATFORM_NAME || 'UE Auth',
	// Some endpoints are only protected through a host whitelist. These are low risk endpoints but providing this protection is a small measure of security - see docs
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
	// UE Auth assumes you will provide an audience to access its API
	UI_CORE_AUDIENCE_ORIGIN: process.env.UI_CORE_AUDIENCE_ORIGIN || envVars.UI_CORE_AUDIENCE_ORIGIN || 'http://localhost:3000',
	// UI_PKCE_REQUIRED tells UE Auth whether to set “token_endpoint_auth_method” to "none" or not for AuthGroup Client creation: true=none
	UI_PKCE_REQUIRED: (process.env.UI_PKCE_REQUIRED === 'true') || envVars.UI_PKCE_REQUIRED || false,
	// Any globally available (across AuthGroups) scopes beyond what is hardcoded or defined per AuthGroup can be set here
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
	// Private scopes to ensure all authgroups can use
	RESTRICTED_SCOPES () {
		try {
			if(process.env.RESTRICTED_SCOPES) return process.env.RESTRICTED_SCOPES.toString().split(',');
			if(envVars.RESTRICTED_SCOPES) return envVars.RESTRICTED_SCOPES.toString().split(',');
			return [];
		} catch (error) {
			console.error(error);
			return [];
		}
	},
	// STATIC_ASSETS are images or CSS for the UI components. If you wish to serve static assets locally, add the appropriate files to ./public and change this to "/"
	STATIC_ASSETS: process.env.STATIC_ASSETS || envVars.STATIC_ASSETS || 'https://assets.uecore.io/ueauth/',
	// CUSTOM_FONTS_URL allows you to change the overall fonts of the system
	CUSTOM_FONTS_URL: process.env.CUSTOM_FONTS_URL || envVars.CUSTOM_FONTS_URL || undefined,
	// DEFAULT_UI_SKIN settings defines how UE AUth typically looks by default before being customized by an AuthGroup
	DEFAULT_UI_SKIN_GRADIENT_LOW: process.env.DEFAULT_UI_SKIN_GRADIENT_LOW || envVars.DEFAULT_UI_SKIN_GRADIENT_LOW || "#131525",
	DEFAULT_UI_SKIN_GRADIENT_HIGH: process.env.DEFAULT_UI_SKIN_GRADIENT_HIGH || envVars.DEFAULT_UI_SKIN_GRADIENT_HIGH || "#1D2035",
	// When the access scope is used as part of an OIDC or oAuth2 flow, the user's organizations, domains, products, roles, and permissions are returned. If the user has access to a large number of products and no filtering was requested, this could be a lot of information when a JWT token is request (not applicable to opaque). ACCESS_OBJECT_SIZE_LIMIT sets a threshold in KB of how much is acceptable. If the amount of information exceeds this threshold, the JWT token does not populate with all of the access claims, but rather a single 'x-access-url' claim that tells any consumer of the token where to get the permissions.
	ACCESS_OBJECT_SIZE_LIMIT: process.env.ACCESS_OBJECT_SIZE_LIMIT || parseInt(envVars.ACCESS_OBJECT_SIZE_LIMIT) || 4000,
	// Any member of an AuthGroup must have certain basic permissions to manage their account. This defines those permissions
	MEMBER_PERMISSIONS: ['member:::accounts::update:own', 'member:::accounts::read:own', 'member:::accounts::delete:own', 'member:::useraccess::delete:own', 'member:::useraccess::read:own','member:::operations-reset-user-password::create', 'member:::operations-user::create:own', 'member:::operations-invite::create:own', 'member:::accounts-notification::read:own'],
	// The Event Emitter writes out a lot of information with regards to the objects of the system. Some of that information could contain sensative information such as passwords or secrets. When this setting is true, sensitive data is sanitized before display.
	EVENT_EMITTER_CLEAN_SENSITIVE: (process.env.EVENT_EMITTER_CLEAN_SENSITIVE === 'true') || envVars.EVENT_EMITTER_CLEAN_SENSITIVE || false,
	// You can set the custom domain header you want to use to track incoming upstream request domains
	CUSTOM_DOMAIN_PROXY_HEADER: process.env.CUSTOM_DOMAIN_PROXY_HEADER || envVars.CUSTOM_DOMAIN_PROXY_HEADER || 'x-host',
	// This is a default/backup of the event emitter options generally defined per AuthGroup.
	DISABLE_STREAMS: envVars.DISABLE_STREAMS || false,
	EVENT_EMITTER: (envVars && envVars.DISABLE_STREAMS === true) ? {} :{
		general: true,
		accessToken: true,
		authorization: false,
		backchannel: false,
		clientCredentials: false,
		deviceCode: false,
		session: true,
		grant: true,
		iat: true,
		uiInteraction: false,
		replayDetection: true,
		pushedAuthorization: true,
		refreshToken: false,
		registration: true,
		account: true,
		group: true,
		pluginNotification: true,
		organization: true,
		domain: true,
		product: true,
		access: true,
		role: true,
		permission: true,
		orgProfile: true,
		securedProfile: true,
	},
	SECURITY_POLICY: {
		// eslint-disable-next-line quotes
		'script-src': [`'self'`, (req, res) => `'nonce-${res.locals.cspNonce}'`],
		'img-src': ['*'],
		'frame-ancestors': (process.env.SECURITY_FRAME_ANCESTORS) ?
			process.env.SECURITY_FRAME_ANCESTORS.split(',') :
			// eslint-disable-next-line quotes
			(envVars.SECURITY_FRAME_ANCESTORS) ? envVars.SECURITY_FRAME_ANCESTORS.split(',') : [`'self'`]
	}
};

module.exports = config;