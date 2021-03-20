import n from './api/plugins/notifications/notifications';
import plugins from "./api/plugins/plugins";
import Boom from '@hapi/boom';

const config = require('./config');

export default {
    /**
     * @param authGroup
     * @param type
     * @param recipient
     * @param routing
     * @param content
     * @returns {Promise<void>}
     * type = string with enum of ['invite', 'forgotPassword', 'passwordless']
     * recipient = 'id', 'email', and 'txt' from user account or elsewhere
     * routing = 'screen' (a screen url to direct user to for), 'url' (notification url - set to global for now)
     * content = 'message' (text for an email or sms), 'subject', and 'meta' (additional info needed)
     */
    async notify(sender, authGroup, type, recipient, routing, content) {
        try {
            const global = await plugins.getLatestPluginOptions();
            if(global.notifications && global.notifications.enabled === true && authGroup.pluginOptions.notification.enabled === true) {
                //todo overrides can eventually go here
                routing.url = global.notifications.notificationServiceUri;
                const notification = {
                    createdBy: sender,
                    iss: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}`,
                    type,
                    formats: [],
                    recipientUserId: recipient.id,
                    recipientEmail: recipient.email,
                    recipientSms: recipient.txt,
                    authGroupId: authGroup.id,
                    screenUrl: routing.screen,
                    destinationUri: routing.url,
                    subject: content.subject,
                    message: content.message,
                    meta: content.meta
                }
                if(notification.recipientEmail) notification.formats.push('email');
                if(notification.recipientSms) notification.formats.push('sms');
                const not = await n.createNotification(notification);
                const resp = await n.sendNotification(not, global);
                return resp;
            }
            console.info('notifications for this authGroup not active');
            return null;
        } catch (error) {
            if(type === 'invite' && authGroup.pluginOptions.notification.ackRequiredOnOptional === false) {
                return error;
            }
            if(error.isAxiosError===true) {
                throw Boom.failedDependency('The notification service did not acknowledge the request. Please try again later');
            }
            throw Boom.boomify(error);
        }
    }
}