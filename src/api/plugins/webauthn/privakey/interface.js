import Boom from '@hapi/boom';
import pInit from '../../challenge/privakey/initApi';

const pkApi = {
	async initGroupPasskey(authGroup, type, provider) {
		if(!provider.setup.key) throw Boom.failedDependency('This MFA provider is not set up');
		const clientID = provider.setup.id;
		const clientSecret = provider.setup.key;
		const privakey = {};
		// call createCompany
		const company = await pInit.createCompany(clientID, clientSecret, authGroup.name);
		privakey.companyName = company.name;
		privakey.companyId = company.id;
		// call createAppSpace
		// todo default logo....?
		const appSpace = await pInit.createAppSpace(clientID, clientSecret, authGroup.name, company.id, authGroup.config.ui?.skin?.logo);
		privakey.appSpaceId = appSpace.id;
		// call createReqOrigin
		const reqOrigin = await pInit.createReqOrigin(clientID, clientSecret, authGroup.id, company.id, appSpace.id);
		// call createAccessKey
		const keys = await pInit.createAccessKey(clientID, clientSecret, authGroup.id, company.id, appSpace.id, reqOrigin.id);
		// call addCallBack
		const cb = await pInit.addCallback(clientID, clientSecret, authGroup.id, company.id, appSpace.id, reqOrigin.id);
		privakey.callbackId = cb.id;
		// return metadata to update AG
		return {
			privakeyClient: reqOrigin.id,
			privakeySecret: keys.data.key,
			privakey
		};
	}
};

export default pkApi;