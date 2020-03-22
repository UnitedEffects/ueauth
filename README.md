# Boilerplate Service

A boilerplate micro service that runs as docker or lambda. WIP - NOT READY FOR USE

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

### DB

If you'd rather use a different database or ODM, the following modifications are necessary:

* change connection.js to the appropriate DB
* validate that slsapp and start both correctly implement connection.js
* in each of your api/resources, change the dal.js file to access the new DB using the new ODM/ORM

## Instruction

* Clone this repo
* Copy the contents to your own repo save the .git data
* yarn
* yarn test
* yarn run dev
* add src/api resources using the logging example

## Todo

* add full test coverage for base boilerplate
* automate a project builder using this template