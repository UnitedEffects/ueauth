# United Effects Auth

[![Codefresh build status]( https://g.codefresh.io/api/badges/pipeline/theboeffect/UE%20Auth%2Fmain?type=cf-2)]( https%3A%2F%2Fg.codefresh.io%2Fpublic%2Faccounts%2Ftheboeffect%2Fpipelines%2F5e9cc14dc2b7b0dc4bc11e79)

A Multi-tenant OIDC Authorization and Access service built on top of [NODE OIDC PROVIDER](https://github.com/panva/node-oidc-provider), which is the only [openid.net](https://openid.net/developers/certified/) certified javascript library currently listed. Multi-tenancy in this context means functionality similar to that provided by SaaS vendors such as Auth0 and Okta. Each tenant is an "authGroup" and all artifacts such as accounts (users) and clients are unique and locked to the authGroup.

This service based on this [boilerplate template](https://github.com/theBoEffect/boilerplate).

## Run

This implementation is built with MongoDB as a dependency; however [NODE OIDC PROVIDER](https://github.com/panva/node-oidc-provider) itself does not have a specific persistence technology dependency and this service could be refactored to operate with any [NODE OIDC PROVIDER](https://github.com/panva/node-oidc-provider) supported DB with minimal effort. Having said that, if you are using this service as is, you'll need MongoDB. For development purposes, I suggest you use docker for a quick test instance as follows:

* DB
    * docker run -p 27017:27017 mongo
* Service
    * yarn
    * yarn test
    * yarn run dev
    * http://localhost:3000/swagger
    * create an authGroup of your choice (i.e. testGroup) POST http://localhost:3000/api/group
        * make note of the initialAccessToken (IAT)
    * Using the IAT as a bearer token, create an account for this authGroup to activate POST http://localhost:3000/api/testGroup/account
    * http://localhost:3000/testGroup/.well-known/openid-configuration
* Recommended setup for dev and manual deployment
    * Do not update .env_ci directly
    * Copy .env_ci to .env
    * Update the json files pertaining to your desired deployment or NODE_ENV configuration
    * Add new deployment/env configurations as desired using the naming "env.NODE_ENV_NAME.json"

### Manual Deployment

* Ensure you have your .env correctly configured. Lets assume we want to deploy QA which pertains to json file env.qa.json
* Ensure that [Serverless](https://serverless.com/) is installed and configured to deploy to aws for your account
* SLS_ENV=qa yarn deploy

## Key Stack Components

* Express
* Mongoose -> MongoDB
* Serverless-http
* openAPI/Swagger
* Express-OpenAPI-Validate
* @hapi/boom
* oData API query
* JSON Patch
* Babel (see libs in package.json)
* Passport (see libs in package.json)
* Jest

### oData Spec

https://www.odata.org/documentation/

### JSON Patch

http://jsonpatch.com/

## TODO

* Auth
    * Use OIDC instead of http calls...?
* create config collection with default set in app - part of authGroup
    * scopes by tenant?
    * Store keys in DB???
* need an initial setup endpoint
    * should tie into permissions
* cleanup
    * swagger & status code cleanup
        * Add oidc endpoints to swagger
    * work through access middleware and get it working correctly for all endpoints
        * ensure endpoints using middleware correctly - do some negative tests
* go feature by feature on the options...
    * keys jwks? Is this as simple as it seems?
    * different grant types - with/without confirmation
    * Setup CORS options
    * figure out logout
* Views
    * need login errors to rendor as a view rather than json
    * Different views by tenant ?
    * Custom error view ?
* Plugins and hooks?
* translate oidc errors to local format in the oidc post middleware
    * You can probably do this with a try catch on the route
* need to have a plan for securing db or hashing client secret
* audit system
    * Event emitter... possibility of something being missed though in a lambda env
* clean up babel build and dev dependencies - no more src/start outside dev - UPDATE BOILERPLATE
* inline todos
* implement with a client/app

## TESTING TODO

* all account
* clients
* auth Groups
* iat for authGroups
* auth functions
* middleware
* oidcMiddleware
* interactions_api
* mongo_adapter
* initial access token
* oidc options validate
* error handling - duplicate mongo error
* config cookie secrets
* jwks keys
* auth layer and permissions

## TODO SWAGGER API
```
{
  authorization: '/auth',
  check_session: '/session/check',
  code_verification: '/device',
  device_authorization: '/device/auth',
  end_session: '/session/end',
  introspection: '/token/introspection',
  initial_access: '/token/initial_access', //custom
  jwks: '/jwks',
  pushed_authorization_request: '/request',
  registration: '/reg',
  revocation: '/token/revocation',
  token: '/token',
  userinfo: '/me'
}
```