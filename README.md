# UE Auth by United Effects LLC

[![Build](https://github.com/UnitedEffects/ueauth/actions/workflows/build.yml/badge.svg)](https://github.com/UnitedEffects/ueauth/actions/workflows/build.yml)

[UEAuth](https://ueauth.com) is a multi-tenant OIDC Provider, User Management, B2B Product Access, and Roles/Permissions Management system intended to create a single hybrid solution to serve as Identity and Access for both self-registered B2C Apps and Enterprise B2B Solutions. The feature set combines similar functionality you find in Commercial SaaS providers for Identity Management and provides the missing pieces enterprises typically have to develop on their own in a single package.

The Multi-tenant OIDC component of UEAuth is built on top of [NODE OIDC PROVIDER](https://github.com/panva/node-oidc-provider), which is the only [openid.net](https://openid.net/developers/certified/) certified javascript library currently listed. Multi-tenancy in this context means each tenant is an "AuthGroup" and all artifacts such as accounts (users) and clients are unique and locked to the AuthGroup.

## Note to Followers

Thank you for your support of UE Auth! We have been adding A LOT of functionality, but we have not updated this documentation just yet. Please be patient as this is all happening with the launch of our commercial SaaS solution which you can access at [unitedeffects.com](https://unitedeffects.com). We will update these documents very soon. In the meantime, you can try UE Auth absolutely free on our [commercial offering](https://core.unitedeffects.com), and you can see the full API documented in our [docs](https://docs.unitedeffects.com).

## LICENSE

This project is available under a modified Apache 2.0 license which states that while you may make use of this product in a number of ways, you may not sell the product as an offering unto itself. UE Auth is a Patent Pending technology, please review the [license](LICENSE.md). Please feel free to [contact us at United Effects](mailto:solution@unitedeffects.com) to discuss alternative licensing options.

### SaaS Offerings

#### Solutions

If you'd like to access the features of UE Auth and much more without having to DIY the solution, please visit our commercial offerings at [United Effects](https://unitedeffects.com) where you can sign up completely free without a credit card. Also, note that the commercial version of UE Auth is 100% free to use for startups with less than $1M in funding, $500K in revenue, and 10K monthly active users.
Alternatively, you may contact us at [solution@unitedeffects.com](mailto:solution@unitedeffects.com).

#### Support

If you're looking for help with a commercial solution, you may contact us at [help@unitedeffects.com](mailto:help@unitedeffects.com).

## API Documentation and Demo

* The UE Auth API is well documented and available at https://docs.unitedeffects.com/reference
* You can signup for an account with UE Auth for free to experiment at https://core.unitedeffects.com
* Once you have an AuthGroup, you can actually utilize the AuthGroup to login directly from swagger by inserting the group into the swagger URL as follows: https://auth.unitedeffects.com/{yourgroup id or prettyName}/swagger
    * Click Authorize and scroll down to the Code Authorization flow. You'll need your AuthGroup associated client_id and client_secret, which would have been provided when you signed up
    * Please note, you will still need to enter a value into the required group fields throughout the API to make openapi requests; however, for your convenience, the ID of the authgroup you've selected is displayed and used rather than whatever you may enter in the field.

## Quick Start

Our help docs have a lot of information to get you started with the technology on our hosted solution. That covers 95% of what's possible with this open source version. You can follow the [Quick Start in our docs](https://docs.unitedeffects.com/reference/getting-started-with-your-api) and try the API immediately.
If you want to try it locally, you can follow these instructions. Feel free to [reach out for help](mailto:help@unitedeffects.com): [Local Setup](https://github.com/UnitedEffects/ueauth/wiki/Local-Setup)

## WIKI Guides

We are in the process of migrating and updating our documentation. We recommend you check out our official documentation to start at https://docs.unitedeffects.com
The below WIKI may be a little out of date in some places. We will resolve that or migrate the pages soon.
If you can't find something you need, reach out: [United Effects Team](mailto:help@unitedeffects.com)

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
