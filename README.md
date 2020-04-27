# United Effects Auth

[![Codefresh build status]( https://g.codefresh.io/api/badges/pipeline/theboeffect/UE%20Auth%2Fmain?type=cf-2)]( https%3A%2F%2Fg.codefresh.io%2Fpublic%2Faccounts%2Ftheboeffect%2Fpipelines%2F5e9cc14dc2b7b0dc4bc11e79)

An OIDC Authorization and Access Service

## Run

* yarn
* yarn test
* yarn run dev
* http://localhost:3000/api/testGroup/.well-known/openid-configuration

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


* how do you change a client secret? (or anything)
* figure out dynamic scopes - tenant based if possible
* create config collection with default set in app
* go feature by feature on the options...
    * keys jwks???
    * use Auth0 as guide and try diff flows
    * different grant types - with/without confirmation
    * figure out logout
* translate oidc errors to local format in the oidc post middleware
* need to have a plan for securing db or hashing client secret
* audit system
* clean up babel build and dev dependencies - no more src/start outside dev
* swagger status code cleanup
* inline todos
* Permissions
    * ensure only tokens associated to auth group are respected for registration
* Views
    * Different views by tenant ?
    * Custom error view ?
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