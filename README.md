# Boilerplate Service

A boilerplate micro service that runs as docker or lambda. Click "Use this Template" to use this for your service.

<a href="https%3A%2F%2Fg.codefresh.io%2Fpipelines%2FBoilerplate%20Validate%2Fbuilds%3FrepoOwner%3DtheBoEffect%26repoName%3Dboilerplate%26serviceName%3DtheBoEffect%252Fboilerplate%26filter%3Dtrigger%3Abuild~Build%3Bbranch%3Amaster%3Bpipeline%3A5e7d486f66ad133bda1c9c8a~Boilerplate%20Validate">
	<img alt="Codefresh build status" src="https://g.codefresh.io/api/badges/pipeline/theboeffect/Boilerplate%2FBoilerplate%20Validate?branch=master&key=eyJhbGciOiJIUzI1NiJ9.NWM5ZjllOTZhMDg1Y2U4Y2NjZjc0ZTJk.vqyjrxOGid6-GptYbV-d5_hzZ9UcK96DhMCo3q3PbGc&type=cf-1">
</a>

#### follow me:
* [twitter](https://twitter.com/theboeffect)
* [linkedIn](https://www.linkedin.com/in/bmotlagh/)
* [instagram](https://www.instagram.com/theboeffect/)

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

## Features

* Configurable MongoDB connection to stand-alone or replica (or atlas)
* oData support for queries
* JSON Patch implemented for updates with mongodb
* OpenAPI (swagger) and Swagger UI (/swagger)
* Automatic API Documentation Generated via ReDoc (/api)
* Automatic schema validation using the OpenAPI spec built in as middleware
* Error handling via @hapi/Boom
* Configurable logging with optional DB persistence
* Works with Docker or Lambda
* Jest test harness

Have other ideas? Feel free to PR!

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

* Click "Use this Template" at the top  of the repository and setup your project
* Update the following in package.json
    * name
    * author
    * description
    * url (your website or project website)
    * logo (your logo or project logo url)
* Copy ./.env_ci to ./.env and modify env.dev.json to set runtime configuration data
* yarn
* yarn test
* yarn run dev
* add src/api resources using the logging example
    * You will also want to update the ci/codefresh.yaml file to point to your repo
    * Note that my CI only tests, there is no deploy stage, you'll need to add it
