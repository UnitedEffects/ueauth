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

* figure out client registration / adapter
    * whats the registration access token for?
    * authgroup is added through payload... build it into adapter
* keys jwks???
* how do I make oidc multtenant by authGroup???
    * options by tenant - including wellknown url
    * Different views by tenant ?
    * Custom error view ?
* figure out logout
* different grant types - with/without confirmation
* go feature by feature on the options...
* implement with a client/app
* authGroup API
* Add oidc endpoints to swagger

## TESTING TODO

* all account
* interactions_api
* mongo_adapter
* oidc options validate
* error handling - duplicate mongo error
* config cookie secrets