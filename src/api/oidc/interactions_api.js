import oidc from './oidc';
import Account from '../accounts/accountOidcInterface';

export default {
    async getInt(req, res, next) {
        try {
            const details = await oidc.interactionDetails(req, res);
            console.log('see what else is available to you for interaction views', details);
            const { uid, prompt, params } = details;

            const client = await oidc.Client.find(params.client_id);

            if (prompt.name === 'login') {
                return res.render('login', {
                    client,
                    uid,
                    details: prompt.details,
                    params,
                    title: 'Sign-in',
                    flash: undefined,
                });
            }

            return res.render('interaction', {
                client,
                uid,
                details: prompt.details,
                params,
                title: 'Authorize',
            });
        } catch (err) {
            return next(err);
        }
    },

    async login(req, res, next) {
        try {
            const { uid, prompt, params } = await oidc.interactionDetails(req, res);
            const client = await oidc.Client.find(params.client_id);

            const accountId = await Account.authenticate(req.body.email, req.body.password);

            if (!accountId) {
                res.render('login', {
                    client,
                    uid,
                    details: prompt.details,
                    params: {
                        ...params,
                        login_hint: req.body.email,
                    },
                    title: 'Sign-in',
                    flash: 'Invalid email or password.',
                });
                return;
            }

            const result = {
                login: {
                    account: accountId,
                },
            };

            await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
        } catch (err) {
            next(err);
        }
    },
    async confirm (req, res, next) {
        try {
            const result = {
                consent: {
                    // rejectedScopes: [], // < uncomment and add rejections here
                    // rejectedClaims: [], // < uncomment and add rejections here
                },
            };
            await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
        } catch (err) {
            next(err);
        }
    },
    async abort (req, res, next) {
        try {
            const result = {
                error: 'access_denied',
                error_description: 'End-User aborted interaction',
            };
            await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
        } catch (err) {
            next(err);
        }
    }
}