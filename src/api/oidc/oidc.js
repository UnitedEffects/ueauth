import { Provider } from 'oidc-provider';
import { uuid } from 'uuidv4';
import Account from '../accounts/accountOidcInterface';
import middle from "../../oidcMiddleware";

const bodyParser = require('koa-bodyparser');
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

    async findById(ctx, sub, token) {
        console.info('here');
        // @param ctx - koa request context
        // @param sub {string} - account identifier (subject)
        // @param token - is a reference to the token used for which a given account is being loaded,
        //   is undefined in scenarios where claims are returned from authorization endpoint
        return {
            accountId: sub,
            // @param use {string} - can either be "id_token" or "userinfo", depending on
            //   where the specific claims are intended to be put in
            // @param scope {string} - the intended scope, while oidc-provider will mask
            //   claims depending on the scope automatically you might want to skip
            //   loading some claims from external resources or through db projection etc. based on this
            //   detail or not return them in ID Tokens but only UserInfo and so on
            // @param claims {object} - the part of the claims authorization parameter for either
            //   "id_token" or "userinfo" (depends on the "use" param)
            // @param rejected {Array[String]} - claim names that were rejected by the end-user, you might
            //   want to skip loading some claims from external resources or through db projection
            async claims(use, scope, claims, rejected) {
                return { sub };
            },
        };
    },

    // let's tell oidc-provider you also support the email scope, which will contain email and
    // email_verified claims
    claims: {
        openid: ['sub', 'group'],
        email: ['email', 'verified'],
        api: ['client_name', 'client_id']
    },
    scopes: ['api'],
    dynamicScopes: [
        '/read:^[a-zA-Z0-9]*/'
    ],
    // let's tell oidc-provider where our own interactions will be
    // setting a nested route is just good practice so that users
    // don't run into weird issues with multiple interactions open
    // at a time.
    interactions: {
        url(ctx) {
            return `/${ctx.req.params.authGroup}/interaction/${ctx.oidc.uid}`;
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
                    if (value !== metadata.auth_group) {
                        throw new InvalidClientMetadata(`You can not move a client from one auth group to another`);
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

function oidcWrapper(tenant) {
    const oidc = new Provider(`${config.PROTOCOL}://${config.SWAGGER}/${tenant}`, configuration);
    oidc.proxy = true;
    oidc.use(bodyParser());
    oidc.use(middle.parseKoaOIDC);
    oidc.use(middle.validateAuthGroup);
    return oidc;
}

export default oidcWrapper;