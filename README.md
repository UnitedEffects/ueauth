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
    * http://localhost:3000/testGroup/.well-known/openid-configuration
* Recommended setup for dev and manual deployment
    * Do not update .env_ci directly
    * copy .env_ci to .env
    * update the json files pertaining to your desired deployment or NODE_ENV configuration
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


* Client setup
    * retest accounts
    * enable initial token required for client - ensure only tokens associated to auth group are respected for registration
    * client scope requests within authGroup
* FIX BOILERPLATE JSONSCHEMA MODEL
* Permissions
    * implemented auth middleware on API
* create config collection with default set in app - part of authGroup
    * figure out dynamic scopes - tenant based if possible
    * Store keys in DB???
* Plugins and hooks?
* Views
    * Different views by tenant ?
    * Custom error view ?
* go feature by feature on the options...
    * keys jwks???
    * use Auth0 as guide and try diff flows
    * different grant types - with/without confirmation
    * figure out logout
* translate oidc errors to local format in the oidc post middleware
    * You can probably do this with a try catch on the route
* need to have a plan for securing db or hashing client secret
* audit system
    * Event emitter... possibility of something being missed though in a lambda env
* clean up babel build and dev dependencies - no more src/start outside dev
* swagger status code cleanup
* inline todos
* implement with a client/app
* Add oidc endpoints to swagger

## TESTING TODO

* all account
* clients
* auth Groups
* middleware
* oidcMiddleware
* interactions_api
* mongo_adapter
* oidc options validate
* error handling - duplicate mongo error
* config cookie secrets
* jwks keys

## TODO SWAGGER API

* /REG - GET, POST, PUT (client control)
* /TOKEN
* other routes