# United Effects Auth

[![CI](https://github.com/UnitedEffects/ueauth/actions/workflows/main.yml/badge.svg?branch=master)](https://github.com/UnitedEffects/ueauth/actions/workflows/main.yml)

A Multi-tenant OIDC Authorization and Access service built on top of [NODE OIDC PROVIDER](https://github.com/panva/node-oidc-provider), which is the only [openid.net](https://openid.net/developers/certified/) certified javascript library currently listed. Multi-tenancy in this context means functionality similar to that provided by SaaS vendors such as Auth0 and Okta. Each tenant is an "authGroup" and all artifacts such as accounts (users) and clients are unique and locked to the authGroup.

This service based on this [boilerplate template](https://github.com/theBoEffect/boilerplate).

## Live (test env)

https://qa.ueauth.io

## Run

This implementation is built with MongoDB as a dependency; however [NODE OIDC PROVIDER](https://github.com/panva/node-oidc-provider) itself does not have a specific persistence technology dependency and this service could be refactored to operate with any [NODE OIDC PROVIDER](https://github.com/panva/node-oidc-provider) supported DB with minimal effort. Having said that, if you are using this service as is, you'll need MongoDB. For development purposes, I suggest you use docker for a quick test instance as follows:

### DB
* docker run -p 27017:27017 mongo

### Service - first run
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
    
### Service - all subsequent usage
* Documentation here: http://localhost:3000/api
* Swagger here: http://localhost:3000/swagger
* create an authGroup of your choice (i.e. testGroup) POST http://localhost:3000/api/group
    * make note of the initialAccessToken (IAT)
* Using the IAT as a bearer token, create an account for this authGroup to activate POST http://localhost:3000/api/testGroup/account
* Make note of the returned data, this is your active Auth Group, Account and UeAuth Client data
* New users will simply create accounts and only see their account information
* http://localhost:3000/testGroup/.well-known/openid-configuration

## The Root Account

The root group is the super admin for the entire service. Any account in the root group has super admin access to all other accounts. This should only be limited to a small number of service and infrastructure admins. The root group is locked, see below.

## Locked Groups

If you choose to lock your group upon creation, it means that users cannot self-register to the group. This is a good options for B2B organizations and applications where all users must be invited by the admin. In this case, they must be created by you the administrator first. You have several options to provide the now existing user with their credentials:

1. You can simply set a password and notify the user outside of the system of their password
2. (RECOMMENDED) You can activate autoVerify in your config (assuming notifications are enabled) and a verification notification will go to the user where they will both accept the account and set a new password
3. You can manually trigger an account verify flow using the operations/user API which results in the same flow as 2 above
4. You can ask the user to initiate a password reset (assuming notifications are enabled) and a notification will go to the user which will functionally give them their credentials through the password reset flow
5. You can manually trigger a password reset flow using the operations/user API which results in the same flow as 4 above

**NOTE: As a time savings step, users can be created without having to define passwords for them using the generatePassword=true property on the Account create API.**
    
## Notification and Message Plugin

This is an interface to allow an external messaging service to handle emails or sms messaging as needed.

First, you must make the appropriate API requests to configure the notification service using a ROOT authgroup access-token. This only works with ROOT admins. To further ensure this does not change frequently, you must do a GET on /plugins/global to see the current version number and include it in your request. This will increment the version number as well.

POST /plugins/global/notification (see swagger)

```json
{
  "enable": true,
  "url": "https://youremailortextservice.com/path",
  "currentVersion": 1
}
```

This will add a registered client specifically for notification requests. It will then return the client-id and client-secret of this new service in the request. Make note of these as your service will need them to request tokens or to validate incoming requests.

```json
{
  "type": "PLUGINS",
  "data": {
    "notifications": {
      "enabled": true,
      "notificationServiceUri": "http://www.something.com",
      "notificationServiceClientId": "your-notification-client-id",
      "notificationServiceClientSecret": "your-notification-client-secret",
      "plugins": {
        "version": 2
      }
    }
  }
}
```

If you wish to disable notifications, you can simply send "enabled": false, to the same endpoint and this registered client will be erased.

Now Auth Group owners can enable their own notifications. If they do so, this will result in a POST http request to the notifications url specified in your enabling request for the following interactions (notification types):

* **general** - Optional: Will work without successful notification depending on config and store the notification for 30 days
* **invite** - Optional: Will work without successful notification depending on config and store the notification for 30 days
* **forgotPassword** - Plugin Required and must succeed
* **verify** - Plugin Required and must succeed
* **passwordless** - Plugin Required and must succeed

To update an authGroup configuration, use the PATCH /group/id endpoint:

```json
[
  {
    "op": "replace",
    "path": "/pluginOptions/notification/enabled",
    "value": true
  },
  {
    "op": "replace",
    "path": "/pluginOptions/notification/ackRequiredOnOptional",
    "value": true
  }
]
```

Regardless of the auth-group interacting with your service, all requests to the Notification Service will be via client-credential tokens against the ROOT authGroup and clientId. Your service should validate the following:

* The token in general - iss, exp, etc...
* That the audience is equal to the Notification Service ClientId issued
* That the notification iss is equal to the token iss
* That you have not received the ID before
* That the authGroup is Root (may change this later if we implement custom servers)

As a final precaution, your service can request its own token and query the Notifications API to validate incoming requests. It will do this using the client_id and client_secret issued, again for the root authGroup.

**NOTE: Notifications only have a 30-day life in service for an audit or query via API.**

The body of the POST will be as follows - shown in JSON schema:

```json
{
    "type": "object",
    "description": "Request sent to your notification plugin url as a POST method",
    "properties": {
        "id": {
          "type": "string",
          "description": "unique id of the notification - save to prevent duplicate requests."
        },
        "iss": {
          "type": "string",
          "description": "IdP issuer - make sure it matches the token"
        },
        "type": {
          "type": "string",
          "description": "kind of request this is",
          "enum": ["invite", "forgotPassword", "passwordless"]
        },
        "formats": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["email", "sms"]
          } 
        },
        "email": {
          "type": "string",
          "format": "email",
          "description": "email address of intended recipient"
        },
        "sms": {
          "type": "string",
          "description": "phone number of intended recipient"
        },
        "authGroup": {
          "type": "object",
          "description": "UE Auth Group to which the recipient is registered",
          "properties": {
            "id":{
              "type": "string"
            },
            "name":{
              "type": "string"
            },
          }   
        },
        "screenUrl": {
          "type": "string",
          "description": "Url of the screen required to process type of notification sent - includes encoded tokens and other query parameters associated to the request. For password related functionality, this is not sent to the API requester directly."
        },
        "meta": {
          "type": "object",
          "description": "Additional json structured data specific to the request that may be useful."
        } 
    }
}
```
In future iterations, there will be an option at an authGroup level to override the DEFAULT_NOTIFICATION_PLUGIN_URL with a customUrl to a different service per Group as desired by the owner.

### Verified Users

If the notification plugin is not enabled, both globally and within the authGroup, accounts will still be not verified when created. If you've set requireVerified to true, you will need to manually verify these accounts and manually set the flag on the account to true. If you do have notifications enabled, it is recommended that you use the autoVerify feature.

**NOTE: The forgot password notification also sets the verify flag to true. There is a specific "verify" notification as well.**

#### Designed Limitations of Self Registration
* You can not enable requireVerified on your authGroup if it is public (locked=false) and you do not have notifications enabled
* Users self-registering to a public (locked=false) authGroup which has set requireVerified true and autoVerify false, must perform a password reset immediately after account creation to verify the account. We highly recommend you set autoVerify to true in this case. Alternatively, you could forgo the user initially setting a password by using the generatePassword option, simplifying the workflow.
    * Note: you can assist by initiating the password-reset or verify-account operations on behalf of the user as well


## Client Session End Links

* /{authGroup}/session/end?client_id={your-client-id}&post_logout_redirect_uri={your-redirect-url}
    * You can pass client_id, id_token_hint (the id token itself), post_logout_redirect_uri, state, or other OIDC params
    * You should always include the post_logout_redirect_uri with a client_id or id_token_hint to make sure the user is directed appropriately. NOTE, if you do not and you click cancel, you'll still see the success page
    * post_logout_redirect_uris must be registered to the client being used for login/logout. The default authgroup client will have the UE Core URL and the AuthGroup primary domain registered.
    
## Whitelisted UI APIs

These are APIs specifically to allow functionality to the UE Core UI. These endpoints are not secured via OIDC but are only accessible through whitelisted hosts as a precaution.

* GET prettyName check
* GET group client Id
* POST token from code/group
* POST password reset

## Manual Deployment

* Ensure you have your .env correctly configured. Lets assume we want to deploy QA which pertains to json file env.qa.json
* Ensure that [Serverless](https://serverless.com/) is installed and configured to deploy to aws for your account
* SLS_ENV=qa yarn deploy
* KEEP THE ABOVE INIT SETUP INSTRUCTIONS IN MIND AND REDEPLOY WITH ROOT SETUP OFF

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

## OIDC Specs

* The root library and docs can be found here: https://github.com/panva/node-oidc-provider/blob/main/docs/README.md
* OIDC Specs themselves are here: https://openid.net/developers/specs/

### Code Authorization Flow Example - Run Locally

* **LOGIN REQUEST** - http://localhost:3000/root/auth?
  <br>response_type=code id_token&
  <br>client_id=[CLIENTID]&
  <br>redirect_uri=https://qa.ueauth.io&
  <br>resource=http://localhost:3000/[AUTHGROUP]&
  <br>scope=openid core:read email username&
  <br>nonce=123&
  <br>state=123
    * Notice this is requesting a resource for an AccessToken
    * This should allow you to login with a username and password and then redirect to provide a code and id_token in the query parameter of the browser url
    * Notice also that we are requesting both id_token scopes and access_token scopes
    * You follow this with a token request, presented as a curl statement here...
* **TOKEN REQUEST**
    * curl -X 'POST' \
'http://localhost:3000/root/token' \
-H 'accept: application/json' \
-H 'Content-Type: application/x-www-form-urlencoded' \
-d 'client_secret=[CLIENTSECRET]&
<br>redirect_uri=https://qa.ueauth.io &
<br>code=[CODERECIEVED]&
<br>client_id=[CLIENTID]&
<br>grant_type=authorization_code'
    * This should respond with an access_token and your id_token
    
## Important Tips and Examples

### ROOT_GROUP_REGISTRATION_UI_URL

This environment variable should point to your implementation of final registration of an authgroup. It is optional. If included, whenever a new authgroup is created, and if notifications are neabled, an email will be sent to the creator of the authgroup with a link to https://ROOT_GROUP_REGISTRATION_UI_URL?group=YOURGROUP&code=InitialAccessToken. This allows them to complete registration if it was interrupted for some reason.

### OIDC Scopes with Clients

This service is an OAuth2 and OIDC provider. What that means is that you can create clients limited to scopes, providing those scopes are also defined for your Auth Group OP scopes. If you do this you will recieve an error whenever you request an authorization against that client on anything but the scopes explicitly added to the client. This is normal. What might trip you up is if you explicitly define scopes and then attempt to do an OIDC authorization, which would require the openid scope. This is not defaulted and if you want your client with limited scopes to also respect the OIDC flows, you will need to also add the "openid" scope.

### Multiple Audience (AUD) as Array

If you request an audience as a single string of multiple urls delimited by spaces (i.e. http:example1.com http:example2.com) they will be parsed as an array in the resulting jwt token.

### Login Without Consent Screen

You can apply "client_skip_consent" = true to a client definition's metadata and this will signal the interaction to assume consent. Only do this for first-party clients (those controlled by the authgroup).

### Assets and Fonts

The primary CSS, JS and Images used for the UIs are served from "https://assets.uecore.io/". The service can be configured to utilize them or from that address through the environment variable STATIC_ASSETS set in CICD/config.js (.env.dev.json.STATIC_ASSETS). If you want to copy the files from assets.uecore.io and serve them directly from this code, simply add them under the ./public directory and change the value of STATIC_ASSETS to "/". You can also point to any other source for these files you wish and update them as desired with this configuration. Additionally, we have included a CUSTOM_FONTS_URL configuration which should point to a "fonts.css" file. If you set this configuration, that file and all subsequent font definitions it points to will be loaded as well. You may then need to update the other asset files to utilize those fonts.

### Headless OIDC Logout

With the rpInitiatedLogout feature enabled, it is possible to initiate logout using the /{group}/session/end endpoint. In UEAuth, you can also do this headless by passing the query parameter json=true to this endpoint. This will return the necessary data for you to confirm the logout with a GET request to /{group}/session/end/confirm using x-www-form-urlencoded parameters "xsrf={secret}" and "logout=yes". The response to this endpoint will be a redirect GET with html as data. At the moment this is unavoidable; however, you can validate your information by reading the header, where a parameter called "json-data" will include a stringified JSON object with the information you need to validate success (assuming you don't want to parse the html). So the steps for headless logout are:

1. GET /{group}/session/end?json=true
  * make note of your secret
2. POST /{group}/session/end/confirm (x-www-form-urlencoded)
  * xsrf=secret
  * logout=yes
  * read the resulting header "json-data" or parse html response

### Logout Without Prompt

It is possible to logout without having to click through the confirmation prompt. This feature only works for specific clients, not globally. Additionally, this only works when you include a post_logout_redirect_uri on logout (the redirect uri itself requires that you include an id_token_hint or client_id). To do this the following configurations must be set:

1. On your client, ensure you have set client_optional_skip_logout_prompt=true
2. In the browser, navigate or link to /{group}/session/end?skipPrompt=true&post_logout_redirect_uri=[your redirect uri]&client_id=[your client id]
  * Note: you could use id_token_hint and your id_token instead of the client_id

This will load session/end screen and auto submit the form to move past and redirect to the provided uri