import { Provider } from 'oidc-provider';
import Account from '../accounts/accountOidcInterface';

const config = require('../../config');
const jwks = require('../../jwks.json');
const MongoAdapter = require('./mongo_adapter');

const configuration = {
    adapter: MongoAdapter,
    clients: [
        {
            client_id: 'foo',
            redirect_uris: ['https://unitedeffects.com'],
            response_types: ['id_token'],
            grant_types: ['implicit'],
            token_endpoint_auth_method: 'none',
        },
    ],
    jwks,

    // oidc-provider only looks up the accounts by their ID when it has to read the claims,
    // passing it our Account model method is sufficient, it should return a Promise that resolves
    // with an object with accountId property and a claims method.
    findAccount: Account.findAccount,

    // let's tell oidc-provider you also support the email scope, which will contain email and
    // email_verified claims
    claims: {
        openid: ['sub'],
        email: ['email', 'verified'],
        group: ['group']
    },

    // let's tell oidc-provider where our own interactions will be
    // setting a nested route is just good practice so that users
    // don't run into weird issues with multiple interactions open
    // at a time.
    interactions: {
        url(ctx) {
            return `/interaction/${ctx.req.params.authGroup}/${ctx.oidc.uid}`;
        },
    },
    features: {
        // disable the packaged interactions
        devInteractions: { enabled: false },
        introspection: { enabled: true },
        revocation: { enabled: true },
        clientCredentials: { enabled: true }
    },
    cookies: {
        keys: config.COOKIE_KEYS()
    },
};

export default new Provider(`${config.PROTOCOL}://${config.SWAGGER}`, configuration);