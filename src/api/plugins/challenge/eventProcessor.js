import acc from '../../accounts/account';
import int from '../../oidc/interactions/interactions';

export default {
	async processEvent(event, ag, accountId, uid, response) {
		try {
			if(event) {
				switch(event.toUpperCase()) {
				case 'PASSWORD_RESET':
					if(response?.state === 'approved') {
					    return acc.passwordResetNotify(ag, accountId);
                    }
					throw response?.state;
				case 'MAGIC_LINK':
					if(response?.state === 'approved') {
					    return int.sendMagicLink(ag, uid, ag?.aliasDnsOIDC || undefined, accountId, undefined);
                    }
                    throw response?.state;
				default:
					// ignored
					throw `IGNORE UNKNOWN EVENT ${event}`;
				}
			}
		} catch (error) {
			console.error(error);
			return false;
		}
	}
};