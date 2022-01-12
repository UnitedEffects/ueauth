export default {
	// this should be maintained...
	linkedin: {
		/**
		 * These are a mix of endpoints from their documentation and some assumptions
		 * https://docs.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
		 */
		'authorization_endpoint': 'https://www.linkedin.com/oauth/v2/authorization',
		'claims_parameter_supported': false,
		'claims_supported': [
			'sub',
			'email'
		],
		'code_challenge_methods_supported': [
			'S256'
		],
		'end_session_endpoint': 'https://www.linkedin.com/oauth/v2/session/end',
		'grant_types_supported': [
			'authorization_code',
			'refresh_token',
			'client_credentials'
		],
		'id_token_signing_alg_values_supported': [
			'PS256',
			'RS256',
			'ES256',
			'EdDSA'
		],
		'issuer': 'https://www.linkedin.com/oauth/v2',
		'response_types_supported': [
			'code'
		],
		'scopes_supported': [
			'openid',
			'offline_access',
			'r_liteprofile',
			'r_emailaddress'
		],
		'subject_types_supported': [
			'public'
		],
		'token_endpoint_auth_methods_supported': [
			'client_secret_basic',
			'none'
		],
		'token_endpoint_auth_signing_alg_values_supported': [
			'HS256',
			'RS256',
			'PS256',
			'ES256',
			'EdDSA'
		],
		'token_endpoint': 'https://www.linkedin.com/oauth/v2/accessToken',
		'request_object_signing_alg_values_supported': [
			'HS256',
			'RS256',
			'PS256',
			'ES256',
			'EdDSA'
		],
		'request_parameter_supported': false,
		'request_uri_parameter_supported': true,
		'require_request_uri_registration': true,
		'userinfo_endpoint': 'https://api.linkedin.com/v2/me',
		'introspection_endpoint': 'https://www.linkedin.com/oauth/v2/introspectToken',
		'introspection_endpoint_auth_methods_supported': [
			'client_secret_basic',
			'none'
		],
		'introspection_endpoint_auth_signing_alg_values_supported': [
			'HS256',
			'RS256',
			'PS256',
			'ES256',
			'EdDSA'
		],
		'request_object_encryption_alg_values_supported': [
			'A128KW',
			'A256KW',
			'dir',
			'RSA-OAEP',
			'ECDH-ES'
		],
		'request_object_encryption_enc_values_supported': [
			'A128CBC-HS256',
			'A128GCM',
			'A256CBC-HS512',
			'A256GCM'
		],
		'claim_types_supported': [
			'normal'
		]
	}
};