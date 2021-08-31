const config = require('../../../config');
const { strict: assert } = require('assert');
export default {
    passwordLessOptions(authGroup, user, iAccessToken, formats = [], uid) {
        const data = {
            iss: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}`,
            createdBy: `proxy-${user.id}`,
            type: 'passwordless',
            formats,
            recipientUserId: user.id,
            recipientEmail: user.email,
            recipientSms: user.sms,
            screenUrl: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}/interaction/${uid}/passwordless?token=${iAccessToken.jti}&sub=${user.id}`,
            subject: `${authGroup.prettyName} - Password Free Login`,
            message: `You have requested a password free login. Click the link to complete your authentication. This link will expire in 15 minutes.`,
        }

        if(formats.length === 0) {
            data.formats = [];
            if(user.email) data.formats.push('email');
            if(user.sms) data.formats.push('sms');
        }
        return data;
    },
    standardLogin(authGroup, client, debug, prompt, session, uid, params, flash = undefined) {
        return {
            client,
            authGroup: authGroup._id,
            authGroupName: (authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : authGroup.name,
            locked: authGroup.locked,
            registerUrl: client.register_url || authGroup.registerUrl || undefined,
            uid,
            tos: authGroup.primaryTOS,
            policy: authGroup.primaryPrivacyPolicy,
            details: prompt.details,
            params,
            title: 'Sign-in',
            session: session ? debug(session) : undefined,
            flash,
            dbg: {
                params: debug(params),
                prompt: debug(prompt)
            }
        }
    },
    pwdlessLogin(authGroup, client, debug, prompt, session, uid, params, flash = undefined) {
        return {
            client,
            authGroup: authGroup._id,
            authGroupName: (authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
            uid,
            locked: authGroup.locked,
            registerUrl: client.register_url || authGroup.registerUrl || undefined,
            details: prompt.details,
            tos: authGroup.primaryTOS,
            policy: authGroup.primaryPrivacyPolicy,
            params,
            title: 'Sign-in Password Free',
            session: session ? debug(session) : undefined,
            flash,
            dbg: {
                params: debug(params),
                prompt: debug(prompt)
            }
        }
    },
    consentLogin(authGroup, client, debug, session, prompt, uid, params) {
        return {
            client,
            uid,
            authGroup: authGroup._id,
            authGroupName: (authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : authGroup.name,
            details: prompt.details,
            tos: authGroup.primaryTOS,
            policy: authGroup.primaryPrivacyPolicy,
            params,
            title: 'Authorize',
            session: session ? debug(session) : undefined,
            dbg: {
                params: debug(params),
                prompt: debug(prompt)
            }
        }
    },
    verifyScreen(authGroup, query) {
        return {
            authGroupName: (authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : authGroup.name,
            tos: authGroup.primaryTOS,
            policy: authGroup.primaryPrivacyPolicy,
            title: 'Verify And Claim Your Account',
            iat: query.code,
            redirect: query.redirect || authGroup.primaryDomain || undefined,
            flash: 'Verification requires you to reset your password. Type the new one and confirm.',
            url: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup._id}/setpass`,
            retryUrl: `${config.PROTOCOL}://${config.SWAGGER}/api/${authGroup._id}/operations/user/reset-password`
        }
    },
    forgotScreen(authGroup, query) {
        return {
            authGroupName: (authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : authGroup.name,
            title: 'Forgot Password',
            tos: authGroup.primaryTOS,
            policy: authGroup.primaryPrivacyPolicy,
            iat: query.code,
            redirect: query.redirect || authGroup.primaryDomain || undefined,
            flash: 'Type in your new password to reset',
            url: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup._id}/setpass`,
            retryUrl: `${config.PROTOCOL}://${config.SWAGGER}/api/${authGroup._id}/operations/reset-user-password`
        }
    },
    async confirmAuthorization(provider, intDetails, authGroup) {
        const { prompt: { name, details }, params, session: { accountId } } = intDetails;
        assert.equal(name, 'consent');
        let { grantId } = intDetails;
        let grant;

        if (grantId) {
            grant = await provider.Grant.find(grantId);
        } else {
            grant = new (provider.Grant)({
                accountId,
                clientId: params.client_id,
                authGroup: authGroup.id
            });
        }
        if (details.missingOIDCScope) {
            grant.addOIDCScope(details.missingOIDCScope.join(' '));
        }
        if (details.missingOIDCClaims) {
            grant.addOIDCClaims(details.missingOIDCClaims);
        }
        if (details.missingResourceScopes) {
            // eslint-disable-next-line no-restricted-syntax
            for (const [indicator, scopes] of Object.entries(details.missingResourceScopes)) {
                grant.addResourceScope(indicator, scopes.join(' '));
            }
        }

        grantId = await grant.save();

        const consent = {};
        if (!intDetails.grantId) {
            // we don't have to pass grantId to consent, we're just modifying existing one
            consent.grantId = grantId;
        }

        return { consent };
    }
}