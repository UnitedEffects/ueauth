import { Provider } from 'oidc-provider';

const config = require('../config');
const jwks = require('../jwks.json');
const MongoAdapter = require('./mongo_adapter');

const configuration = {
    // configure Provider to use the adapter
    adapter: MongoAdapter,
    clients: [
        // reconfigured the foo client for the purpose of showing the adapter working
        {
            client_id: 'foo',
            redirect_uris: ['https://example.com'],
            response_types: ['id_token'],
            grant_types: ['implicit'],
            token_endpoint_auth_method: 'none',
        },
    ],
    jwks,
    formats: {
        AccessToken: 'jwt',
    },
    features: {
        encryption: { enabled: true },
        introspection: { enabled: true },
        revocation: { enabled: true },
    },
};

export default new Provider(`${config.PROTOCOL}://${config.SWAGGER}`, configuration);