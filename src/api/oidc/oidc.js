import { Provider } from 'oidc-provider';
import { uuid } from 'uuidv4';
import Account from '../accounts/accountOidcInterface';

const config = require('../../config');
const jwks = require('../../jwks.json');
const MongoAdapter = require('./mongo_adapter');
const {
    errors: { InvalidClientMetadata },
} = require('oidc-provider');

const configuration = {
    adapter: MongoAdapter,
    clients: [
        {
            client_id: 'foo',
            redirect_uris: ['https://unitedeffects.com'],
            response_types: ['id_token'],
            grant_types: ['implicit'],
            token_endpoint_auth_method: 'none',
            auth_group: 'test',
            client_name: 'admin'
        }
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
    scopes: ['api1'],
    dynamicScopes: [
        '/read:^[a-zA-Z0-9]*/'
    ],
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
        clientCredentials: { enabled: true },
        //jwtResponseModes: { enabled: true },
        //sessionManagement: { enabled: true},
        registration: {
            enabled: true,
            idFactory: uuid,
            initialAccessToken: false, //work this out later to true
        },
        registrationManagement: {
            enabled: true,
            rotateRegistrationAccessToken: true
        }
    },
    extraClientMetadata: {
        properties: ['auth_group', 'client_name'],
        validator(key, value, metadata) {
            if (key === 'auth_group') {
                try {
                    if (value === undefined || value === null) {
                        throw new InvalidClientMetadata(`${key} is required`);
                    }
                } catch (error) {
                    if (error.name === 'InvalidClientMetadata') throw error;
                    throw new InvalidClientMetadata(error.message);
                }
            }
            if (key === 'client_name') {
                try {
                    if (value === undefined || value === null) throw new InvalidClientMetadata(`${key} is required`);
                } catch (error) {
                    if (error.name === 'InvalidClientMetadata') throw error;
                    throw new InvalidClientMetadata(error.message);
                }
            }
        }
    },
    formats: {
        ClientCredentials(ctx, token) {
            const types = ['jwt', 'legacy', 'opaque', 'paseto'];
            if (ctx.oidc) {
                if (ctx.oidc.body){
                    if (types.includes(ctx.oidc.body.format))
                        return ctx.oidc.body.format;
                }
            }
            return 'jwt';
        },
        AccessToken: 'jwt'
    },
    cookies: {
        keys: config.COOKIE_KEYS()
    },
};

//todo this wont' work...
export default new Provider(`${config.PROTOCOL}://${config.SWAGGER}/oidc/`, configuration);