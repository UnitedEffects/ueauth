const config = require('../../config');

const screens = {
	baseSettings(authGroup) {
		return {
			authGroupLogo: authGroup.config.ui?.skin?.logo || undefined,
			splashImage: authGroup.config.ui?.skin?.splashImage || undefined,
			favicon: authGroup.config.ui?.skin?.favicon,
			bgGradientLow: authGroup.config.ui.skin.bgGradientLow || config.DEFAULT_UI_SKIN_GRADIENT_LOW,
			bgGradientHigh: authGroup.config.ui.skin.bgGradientHigh || config.DEFAULT_UI_SKIN_GRADIENT_HIGH
		};
	},
	panic(authGroup, safeAG, code) {
		return {
			title: 'Emergency Lock',
			message: 'This wizard will allow you to lock your account if you believe you have been compromised. You have 10 minutes to click the button after arriving on this screen, otherwise you will need to refresh. Your general access to this screen, as provided by the notification you received, is limited to 2 hours.',
			authGroup: safeAG,
			code,
			panicUrl: `${config.PROTOCOL}://${(authGroup.aliasDnsOIDC) ? authGroup.aliasDnsOIDC : config.SWAGGER}/api/${authGroup.id}/account/panic`,
			...screens.baseSettings(authGroup)
		};
	},
	recoverFromPanic(authGroup, safeAG) {
		return {
			title: 'Don\'t Panic',
			message: 'You can use this wizard to recover a locked account. This will only work if you or the admin have locked your account in response to unusual activity. You will need your single use recovery codes and you must enter all 10 of them.',
			authGroup: safeAG,
			...screens.baseSettings(authGroup),
			startRecoveryUri: `${config.PROTOCOL}://${(authGroup.aliasDnsOIDC) ? authGroup.aliasDnsOIDC : config.SWAGGER}/api/${authGroup.id}/account/start-recovery`,
			recoverUri: `${config.PROTOCOL}://${(authGroup.aliasDnsOIDC) ? authGroup.aliasDnsOIDC : config.SWAGGER}/api/${authGroup.id}/account/recover`
		};
	},
	verifyScreen(safeAg, authGroup, email) {
		return {
			title: 'Account Verified',
			message: `Congrats ${email}! You have successfully verified this account.`,
			authGroup: safeAg,
			...screens.baseSettings(authGroup)
		};
	},
	forgotScreen(authGroup, query, aliasDns = undefined, aliasUi = undefined) {
		return {
			authGroupName: (authGroup.name === 'root') ? config.ROOT_COMPANY_NAME : authGroup.name,
			title: 'Reset Password',
			description: 'In order to reset your password, type them below.',
			actionButton: 'Save new password',
			tosUri: authGroup.primaryTOS,
			policyUri: authGroup.primaryPrivacyPolicy,
			iat: query.code,
			redirect: query.redirect ||
                authGroup.primaryDomain ||
                `https://${(aliasUi) ? aliasUi : config.UI_URL}/${authGroup.prettyName}` || undefined,
			url: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/${authGroup._id}/setpass`,
			retryUrl: `${config.PROTOCOL}://${(aliasDns) ? aliasDns : config.SWAGGER}/api/${authGroup._id}/operations/reset-user-password`,
			...screens.baseSettings(authGroup)
		};
	},
};

export default screens;