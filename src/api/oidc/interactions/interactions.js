const config = require('../../../config');

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
}