import oidc from '../oidc';
import Account from '../../accounts/accountOidcInterface';
import {say} from "../../../say";
import acc from '../../accounts/account';
const config = require('../../../config');

export default {
	async getInt(req, res, next) {
		try {
			const details = await oidc(req.authGroup).interactionDetails(req, res);
			//console.log('see what else is available to you for interaction views', JSON.stringify(details, null, 2));
			const { uid, prompt, params } = details;

			//todo client should be specific to authGroup as well...
			const client = await oidc(req.authGroup).Client.find(params.client_id);

			if (prompt.name === 'login') {
				return res.render('login', {
					client,
					authGroup: req.authGroup._id,
					authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
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
				authGroup: req.authGroup._id,
				authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
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
			const { uid, prompt, params } = await oidc(req.authGroup).interactionDetails(req, res);
			const client = await oidc(req.authGroup).Client.find(params.client_id);

			// email will check against username as well... todo do we want to control that?
			const accountId = await Account.authenticate(req.authGroup, req.body.email, req.body.password);

			if (!accountId) {
				res.render('login', {
					client,
					uid,
					authGroup: req.authGroup._id,
					authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
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

			await oidc(req.authGroup).interactionFinished(req, res, result, { mergeWithLastSubmission: false });
		} catch (err) {
			next(err);
		}
	},
	async confirm (req, res, next) {
		try {
			const result = {
				consent: {
					rejectedScopes: req.body.rejectedScopes || [],
					rejectedClaims: req.body.rejectedClaims || [],
				},
			};
			await oidc(req.authGroup).interactionFinished(req, res, result, { mergeWithLastSubmission: true });
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
			await oidc(req.authGroup).interactionFinished(req, res, result, { mergeWithLastSubmission: false });
		} catch (err) {
			next(err);
		}
	},
	async forgot (req, res, next) {
	    try {
			const newPassword = req.body.password;
			const update = [
				{
					op: 'replace',
					path: '/password',
					value: newPassword
				},
				{
					op: 'replace',
					path: '/verified',
					value: true
				}
			];
			await acc.patchAccount(req.authGroup.id, req.user.sub, update, req.user.sub);
			return res.respond(say.noContent('Password Reset'));
		} catch (err) {
	    	next (err);
		}
	},

	async verifyAccountScreen (req, res, next) {
		try {
			if(!req.query.code) {
				if(req.query.email) {
					return res.render('error', {
						title: 'Sent Password Reset',
						message: 'Looks like successfully sent your password reset link.',
						details: 'Check your email or mobile device.'
					})
				}
				return res.render('error', {
					title: 'Uh oh...',
					message: 'Invalid Verify Account Request',
					details: 'This page requires special access. Check your email or mobile device for the link.'
				})

			}
			return res.render('verify', {
				authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
				title: 'Verify And Claim Your Account',
				iat: req.query.code,
				redirect: req.query.redirect || req.authGroup.primaryDomain || undefined,
				flash: 'Verification requires you to reset your password. Type the new one and confirm.',
				url: `${config.PROTOCOL}://${config.SWAGGER}/${req.authGroup._id}/setpass`,
				retryUrl: `${config.PROTOCOL}://${config.SWAGGER}/api/${req.authGroup._id}/operations/user/reset-password`
			});
		} catch (err) {
			next (err);
		}
	},

	async forgotPasswordScreen (req, res, next) {
		try {
			if(!req.query.code) {
				if(req.query.email) {
					return res.render('error', {
						title: 'Resent Password Reset',
						message: 'Looks like successfully resent your password reset link.',
						details: 'Check your email or mobile device.'
					})
				}
				return res.render('error', {
					title: 'Uh oh...',
					message: 'Invalid Reset Password Request',
					details: 'This page requires special access. Check your email or mobile device for the link.'
				})

			}
			return res.render('forgot', {
				authGroupName: (req.authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : req.authGroup.name,
				title: 'Forgot Password',
				iat: req.query.code,
				redirect: req.query.redirect || req.authGroup.primaryDomain || undefined,
				flash: 'Type in your new password to reset',
				url: `${config.PROTOCOL}://${config.SWAGGER}/${req.authGroup._id}/setpass`,
				retryUrl: `${config.PROTOCOL}://${config.SWAGGER}/api/${req.authGroup._id}/operations/user/reset-password`
			});
		} catch (err) {
			next (err);
		}
	}
};