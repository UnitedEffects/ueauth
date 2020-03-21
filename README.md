# Boilerplate Service

A boilerplate micro service that runs as docker or lambda. WIP - NOT READY FOR USE

## Key Stack Components

* Express
* Mongoose -> MongoDB
* Serverless-http
* openAPI/Swagger
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

## Initial Todo

3. Complete the automatic schema check system with openApi - ensure performance
4. Complete the unit testing framework
5. Update readme
6. Test docker and lambda
7. Within Readme, explain how the ODM can be swapped out for a different persistence if preferred