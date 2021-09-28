# UE Auth by United Effects LLC

[![CI](https://github.com/UnitedEffects/ueauth/actions/workflows/main.yml/badge.svg?branch=master)](https://github.com/UnitedEffects/ueauth/actions/workflows/main.yml)

UEAuth is a Multi-tenant OIDC Authorization and Access service built on top of [NODE OIDC PROVIDER](https://github.com/panva/node-oidc-provider), which is the only [openid.net](https://openid.net/developers/certified/) certified javascript library currently listed. Multi-tenancy in this context means functionality similar to that provided by SaaS vendors such as Auth0 and Okta. Each tenant is an "AuthGroup" and all artifacts such as accounts (users) and clients are unique and locked to the AuthGroup.

In addition to providing the ability for users to login using OIDC, UEAuth combines the provider with User, Organization, Domain, Product, Role and Permission Management functionality and APIs. The primary areas of functionality are:

* **AuthGroup** - An AuthGroup is a pool of uniquely identified users. AuthGroups can be private, requiring admins to add users, or public, allowing users to simply self-register. It is also possible to make the AuthGroup public but add further restrictions at an Organization, Domain or Product level. AuthGroups allow configuration of the OIDC authorization solution which users employ for login. Current logins supported include all standard OIDC flows and Magic Links built on OIDC. In the future we will support SAML and MFA. Email based interaction are provided through a notification plugin interface.
* **User Management** - The ability to define and administrate accounts (users) within the context of an AuthGroup, Organization, or Domain.
* **Organization Management** - (PENDING COMPLETION) The ability to define collections of accounts within an AuthGroup that have common access to things like customers or departments. For example: If Sage Industries has an AuthGroup representing a pool of unique users, they may also have a b2b customer called Acme Rockets Inc. which some of their users would need to access. Acme Rockets Inc. is an Organization within the Sage Industries AuthGroup.
* **Domain Management** - (PENDING COMPLETION) Domains further subsets of Organizations which create finer access control. For example: Lets say Sage Industries sells Enterprise Resource Management (ERM) software to Acme Rockets Inc. Sage Industries has a large global pool of users, this is their AuthGroup, and some of those users need access to Acme Rockets Inc. which is represented as an Organization within Sage Industries. Acme Rockets has multiple departments that use the new ERM software and each needs different access to that software. Each department could be represented as a Domain with in the Acme Rockets Organization.
* **Product Management** - (PENDING COMPLETION) Product Management allows you to define the products to which your users, organizations, or domains will need access and permissions. Products could be public with self-service access or private requiring admin provided access.
* **Role Management** - (PENDING COMPLETION) Roles are groupings of permissions which can be applied to Accounts (users) within the context of an Organization, Domain, and Product.
* **Permission Management** - (PENDING COMPLETION) Permissions are nothing more than a data record indicating a coupling of a TARGET and an allowed ACTION within the context of a Product. The UE Auth Permissions service does not enforce permissions, it defines them. Permissions will be present on tokens either directly or through a provided link on the token depending on their size. The permissions provided on the token can be scoped to a single organization/domain/product for that user or return all possible permissions.

## Links

### Demo

https://qa.ueauth.io

### Project Page

https://ueauth.io

### United Effects

https://unitedeffects.com

## Documentation

Please note that we are just now open sourcing this project, and we are still working through the documentation. It will get better over time.

### Getting Started

https://github.com/UnitedEffects/ueauth/wiki/Quick-Start

### Specifications

https://github.com/UnitedEffects/ueauth/wiki/Specifications

### Developer Info

https://github.com/UnitedEffects/ueauth/wiki/Developer-Info

## Notifications Plugin

https://github.com/UnitedEffects/ueauth/wiki/Notification-Plugin


## Todo

* TEST - Make sure you can't POST with account.orgs or account.domains
* if product is deleted, it must be removed from all organizations and all domains
* if product is removed from organization, it must be removed from all associated domains
* Ensure org added to an account exsists first
* Ensure domain added to an account exists and is part of the associated org first
* Setup invites to orgs and/or domains
