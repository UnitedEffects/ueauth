# UE Auth by United Effects LLC

[![Build](https://github.com/UnitedEffects/ueauth/actions/workflows/build.yml/badge.svg)](https://github.com/UnitedEffects/ueauth/actions/workflows/build.yml)

[UEAuth](https://ueauth.com) is a multi-tenant OIDC Provider, User Management, B2B Product Access, and Roles/Permissions Management system intended to create a single hybrid solution to serve as Identity and Access for both self-registered B2C Apps and Enterprise B2B Solutions. The feature set combines similar functionality you find in Commercial SaaS providers for Identity Management and provides the missing pieces enterprises typically have to develop on their own in a single package.

The Multi-tenant OIDC component of UEAuth is built on top of [NODE OIDC PROVIDER](https://github.com/panva/node-oidc-provider), which is the only [openid.net](https://openid.net/developers/certified/) certified javascript library currently listed. Multi-tenancy in this context means each tenant is an "AuthGroup" and all artifacts such as accounts (users) and clients are unique and locked to the AuthGroup.

## Note to Followers

Thank you for your support of UE Auth! We have been adding A LOT of functionality, but we have not updated this documentation just yet. Please be patient as this is all happening with the launch of our commercial SaaS solution which you can access at [unitedeffects.com](https://unitedeffects.com). We will update these documents very soon. In the meantime, you can access our up-to-date API documentation in our demo environment here: [DEMO API DOCS](https://qa.ueauth.io/api)

## LICENSE

This project is available under a modified Apache 2.0 license which states that while you may make use of this product in a number of ways, you may not sell the product as an offering unto itself. UE Auth is a Patent Pending technology, please review the [license](LICENSE.md). Please feel free to [contact us at United Effects](mailto:solution@unitedeffects.com) to discuss alternative licensing options.

### SaaS Offerings

#### Solutions

If you'd like to access the features of UE Auth and much more without having to DIY the solution, please visit our commercial offerings at [United Effects](https://unitedeffects.com) where our Beta is free to use, and there will always be a free tier. Alternatively, you may contact us at [solution@unitedeffects.com](mailto:solution@unitedeffects.com).

#### Support

If you're looking for help with a commercial solution, you may contact us at [help@unitedeffects.com](mailto:help@unitedeffects.com).


## Object Relationship Model

![Object Relationships Diagram](https://unitedeffects.com/docs/object-relationships.jpeg)

## API Documentation and Demo

* [Demo Service](https://qa.ueauth.io)
* The UE Auth API is well documented and available here: https://qa.ueauth.io/api
* You can create an AuthGroup and experiment with the API in the demo account using swagger: https://qa.ueauth.io/swagger
    * See Getting Started below for details
* Once you have an AuthGroup, you can actually utilize the AuthGroup to login directly from swagger by inserting the group into the swagger URL as follows: https://qa.ueauth.io/{yourgroup id or prettyName}/swagger
    * Click Authorize and scroll down to the Code Authorization flow. You'll need your AuthGroup associated client_id and client_secret, which would have been provided when you signed up
    * Please note, you will still need to enter a value into the required group fields throughout the API to make openapi requests; however, for your convenience, the ID of the authgroup you've selected is displayed and used rather than whatever you may enter in the field.

## Manual Quick Start with the Demo

1. Navigate to https://qa.ueauth.io/swagger
2. Access the [Group creation API - POST /api/group](https://qa.ueauth.io/swagger#/Auth%20Groups/post_api_group)
3. Click "Try it out" and define the POST request object ensuring the required fields are defined:
```json
{
  "name": "Your Group Name",
  "prettyName": "your_url_friendly_name",
  "owner": "you@example.com",
  "locked": false,
  "primaryDomain": "https://example.com",
  "primaryEmail": "info@example.com"
}
```
4. Make the request and take note of the response properties. One of them will be an initialAccessToken. Another property will be the securityExpiration, which is how long you have to create your account and activate the AuthGroup before it auto deletes.
5. Access the [Account creation API - POST /api/your_url_friendly_name/account](https://qa.ueauth.io/swagger#/Users/writeAccount)
6. Click the Authorization button and paste the initialAccessToken from step 4 into the bearer field
7. Click "Try it out" and define the POST request object for the account. Make sure you use the same email address you used to define the Owner when you created your AuthGroup - your@example.com
```json
{
  "username": "you@example.com",
  "email": "you@example.com",
  "password": "yourpassword"
}
```
8. Make the request. This will create your account, activate your AuthGroup, provide a oAuth Client with client_id and client_secret, initialize the primary products, organizations and domains and finally associate you to those products so you have full Admin privileges.
9. Access your well-known URL here: https://qa.ueauth.io/your_url_friendly_name/.well-known/openid-configuration
    
## Optional Dependency

* TODO pulsar-client optional dependency overview and limitations here

## Guides

Please note, documentation is still a work in progress. If you can't find something you need, reach out: [United Effects Team](mailto:help@unitedeffects.com)

* [UE Auth](https://github.com/UnitedEffects/ueauth/wiki)
* [Overview](https://github.com/UnitedEffects/ueauth/wiki/Overview)
* [Getting Started](https://github.com/UnitedEffects/ueauth/wiki/Getting-Started)
* [Local Setup](https://github.com/UnitedEffects/ueauth/wiki/Local-Setup)
* [Specifications](https://github.com/UnitedEffects/ueauth/wiki/Specifications)
* [System Configuration](https://github.com/UnitedEffects/ueauth/wiki/System-Configuration)
* [AuthGroup Configuration](https://github.com/UnitedEffects/ueauth/wiki/AuthGroup-Configuration)
* [Notification Plugin](https://github.com/UnitedEffects/ueauth/wiki/Notification-Plugin)
* [FAQ & Tips](https://github.com/UnitedEffects/ueauth/wiki/FAQ-and-Tips)

UE Auth is a Patent Pending Technology. Please read the License before use.

## Investment Opportunities

If you are interested in learning about investment opportunities with United Effects, contact [invest@unitedeffects.com](mailto:invest@unitedeffects.com)

Copyright (c) 2023 [United Effects LLC](https://unitedeffects.com), all rights reserved.
