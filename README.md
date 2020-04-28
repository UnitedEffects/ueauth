# United Effects Auth

[![Codefresh build status]( https://g.codefresh.io/api/badges/pipeline/theboeffect/UE%20Auth%2Fmain?type=cf-2)]( https%3A%2F%2Fg.codefresh.io%2Fpublic%2Faccounts%2Ftheboeffect%2Fpipelines%2F5e9cc14dc2b7b0dc4bc11e79)

A Multi-tenant OIDC Authorization and Access service built on top of [NODE OIDC PROVIDER](https://github.com/panva/node-oidc-provider), which is the only [openid.net](https://openid.net/developers/certified/) certified javascript library currently listed. Multi-tenancy in this context means functionality similar to that provided by SaaS vendors such as Auth0 and Okta. Each tenant is an "authGroup" and all artifacts such as accounts (users) and clients are unique and locked to the authGroup.

This service based on this [boilerplate template](https://github.com/theBoEffect/boilerplate).

## Run

* yarn
* yarn test
* yarn run dev
* http://localhost:3000/swagger
* create an authGroup of your choice (i.e. testGroup) POST http://localhost:3000/api/group
* http://localhost:3000/testGroup/.well-known/openid-configuration

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
    * how do you change a client secret? (or anything)
    * enable token required for client - ensure only tokens associated to auth group are respected for registration
* Permissions
    * implemented auth middleware on API
* create config collection with default set in app - part of authGroup
    * figure out dynamic scopes - tenant based if possible
    * Store keys in DB???
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