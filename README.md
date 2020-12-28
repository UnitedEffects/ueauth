# United Effects Auth

[![Codefresh build status]( https://g.codefresh.io/api/badges/pipeline/theboeffect/UE%20Auth%2Fmain?type=cf-2)]( https%3A%2F%2Fg.codefresh.io%2Fpublic%2Faccounts%2Ftheboeffect%2Fpipelines%2F5e9cc14dc2b7b0dc4bc11e79)

A Multi-tenant OIDC Authorization and Access service built on top of [NODE OIDC PROVIDER](https://github.com/panva/node-oidc-provider), which is the only [openid.net](https://openid.net/developers/certified/) certified javascript library currently listed. Multi-tenancy in this context means functionality similar to that provided by SaaS vendors such as Auth0 and Okta. Each tenant is an "authGroup" and all artifacts such as accounts (users) and clients are unique and locked to the authGroup.

This service based on this [boilerplate template](https://github.com/theBoEffect/boilerplate).

## Live (test env)

https://qa.ueauth.io

## Run

This implementation is built with MongoDB as a dependency; however [NODE OIDC PROVIDER](https://github.com/panva/node-oidc-provider) itself does not have a specific persistence technology dependency and this service could be refactored to operate with any [NODE OIDC PROVIDER](https://github.com/panva/node-oidc-provider) supported DB with minimal effort. Having said that, if you are using this service as is, you'll need MongoDB. For development purposes, I suggest you use docker for a quick test instance as follows:

* DB
    * docker run -p 27017:27017 mongo
    
* Service - first run
    * cp .env_ci to .env
        * Do not update .env_ci directly
        * Copy .env_ci to .env
        * Update the json files pertaining to your desired deployment or NODE_ENV configuration
        * Add new deployment/env configurations as desired using the naming "env.NODE_ENV_NAME.json"
    * within .env/env.dev.json, set the following
        * ALLOW_ROOT_CREATION = true
        * ROOT_EMAIL = you@yourdomain.com
        * ONE_TIME_PERSONAL_ROOT_CREATION_KEY = YOUR_ONE_TIME_SECRET
        * set other values as you like
    * yarn
    * yarn test
    * yarn run dev
    * curl -X POST "http://localhost:3000/api/init" -H  "accept: application/json" -H  "Content-Type: application/json" -d "{\"password\":\"YOURPASSWORD\",\"setupCode\":\"YOUR_ONE_TIME_SECRET\"}"
        * NOTE, this is a one time setup action and is not represented in swagger
        * Copy the resulting AuthGroup, Account, and Client data for future use
    * within .env/env.dev.json set the following and redeploy
        * ALLOW_ROOT_CREATION = false
        * ONE_TIME_PERSONAL_ROOT_CREATION_KEY = ""
    * YOU HAVE JUST CREATED THE ROOT SUPER ADMIN ACCOUNT
    * http://localhost:3000/root/.well-known/openid-configuration
    * YOU MUST DO THIS IN ANY NEW DEPLOYED ENVIRONMENT AS WELL
    
* Service - all subsequent usage
    * Documentation here: http://localhost:3000/api
    * Swagger here: http://localhost:3000/swagger
    * create an authGroup of your choice (i.e. testGroup) POST http://localhost:3000/api/group
        * make note of the initialAccessToken (IAT)
    * Using the IAT as a bearer token, create an account for this authGroup to activate POST http://localhost:3000/api/testGroup/account
    * Make note of the returned data, this is your active Auth Group, Account and UeAuth Client data
    * New users will simply create accounts and only see their account information
    * http://localhost:3000/testGroup/.well-known/openid-configuration

### Manual Deployment

* Ensure you have your .env correctly configured. Lets assume we want to deploy QA which pertains to json file env.qa.json
* Ensure that [Serverless](https://serverless.com/) is installed and configured to deploy to aws for your account
* SLS_ENV=qa yarn deploy
* KEEP THE ABOVE INIT SETUP INSTRUCTIONS IN MIND AND REDEPLOY WITH ROOT SETUP OFF

## The Root Account

The root group is the super admin for the entire service. Any account in the root group has super admin access to all other accounts. This should only be limited to a small number of service and infrastructure admins. The root group is locked, see below.

## Locked Groups

If you choose to lock your group upon creation, it means that users can not self register to the group. In this case, they must either be provided with an initial access token (option 1), or they must attempt to register which will trigger a access request which the admin (you) must confirm (option 2 - this second usecase is pending).

For this example, we will assume you are adding a user to the root group.

* Option 1
    * As the creator of your group, you already have an account. Use one of the OIDC flows to receive a token
    * Use this token as your bearer token to make an http request to 'POST /root/token/initial-access' making sure to include the email of the user you are inviting in the body { "userEmail": "yourfriend@email.com" }
    * The resulting initial access token (the jti property) can now be used as a bearer token on the 'POST /api/root/account' with appropriate body { username, email, password }
    * If the request is made within the iat expiration window (default 7 days) and the email matches userEmail above, the account will be created
* Option 2
    * PENDING FUNCTIONALITY

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

* Need way to transfer ownership of a group
    * code complete, must test...
    * Document how this should be interfaced...
* Validate deactivate or delete (with warning) and reactivate accounts if I’m the owner or admin
    * test super admin
    * test owner
    * test self
* How do account invites work?
    * create inactive account with auto generated password
    * Use Invite type 'account'
    * Claim invite? using associated IAT-JTI?
        * Should you still be able to create an account with an IAT? I'm thinking no... only claim
    * As an additional option, we should allow for access requests, meaning a user can creae an account and an admin can confirm. No access until confirmation.
        * This should be a config flag on the group
* cleanup 1
    * work through access middleware and get it working correctly for all endpoints
        * ensure endpoints using middleware correctly - do some negative tests
        * figure out permissions per endpoint required...
        * read/write/admin scopes?
        * update modifiedby data
* Setup CD to QA
* Views
    * need login errors to rendor as a view rather than json
    * Different views by tenant ?
    * Custom error view ?
* translate oidc errors to local format in the oidc post middleware
    * You can probably do this with a try catch on the route
* audit system
    * Event emitter... possibility of something being missed though in a lambda env
* Cleanup 2
    * go feature by feature on the options...
        * different grant types - with/without confirmation
        * Setup CORS options
        * figure out logout
    * clean up babel build and dev dependencies - no more src/start outside dev - UPDATE BOILERPLATE
    * review inline todos
* Write high risk area Tests!!!!
* implement with a client/app (mmv api portal)
* Open Source this Library (add link in spec)
* MVP release

## TESTING TODO

* all account
* clients
* auth Groups
* open group registration on/off
* auth Group jwks and Config Generation
* jwks keys
* iat for authGroups
* auth functions
* middleware
* oidcMiddleware
* permissions
* root access vs not
* interactions_api
* mongo_adapter
* initial access token
* oidc options validate
* error handling - duplicate mongo error
* config cookie secrets
* auth layer and permissions

## Roadmap

* Define a system for Plugins and Hooks (allows permissions, MFA, etc)
* Investigate securing db or hashing client secrets
* Define custom jwks key configuration rather than using default for AuthGroups
* Create Account Validation and default to false until complete
* Move remaining OIDC configurations to authGroup