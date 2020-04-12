# United Effects Auth

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

* authGroup API
* go feature by feature on the options...
* keys jwks???
* figure out logout
* translate oidc errors to local format in the oidc post middleware
* different grant types - with/without confirmation
* Permissions
    * ensure only tokens associated to auth group are respected for registration
* Views
    * Different views by tenant ?
    * Custom error view ?
* implement with a client/app
* Add oidc endpoints to swagger

## TESTING TODO

* all account
* interactions_api
* mongo_adapter
* oidc options validate
* error handling - duplicate mongo error
* config cookie secrets