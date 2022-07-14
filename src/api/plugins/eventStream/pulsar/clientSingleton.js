import client from '../../../oidc/client/clients';

class PulsarClient {
	constructor() {
		throw new Error('Use PulsarClient.getInstance()');
	}

	static async getInstance(provider) {
		if (!PulsarClient.instance) {
			let Pulsar;
			try {
				Pulsar = require('pulsar-client');
			} catch (error) {
				throw 'This environment does not support the Pulsar event streaming plugin - the pulsar client is not installed';
			}

			let auth;
			if(provider?.streamAuth === true) {
				const params = {
					issuer_url: provider?.auth?.issuerUrl
				};
				params['client_id'] = provider?.auth?.clientId;
				const cl = await client.getOneByAgId(provider?.auth?.rootRef, params.client_id);
				params['client_secret'] = cl.payload.client_secret;
				params['audience'] = provider?.auth?.audience;
				if(provider?.auth?.scope) params['scope'] = provider?.auth?.scope;
				auth = new Pulsar.AuthenticationOauth2(params);
			}
			const clientConfig = {
				serviceUrl: provider?.streamUrl,
				...provider?.clientConfig
			};

			if(auth) clientConfig['authentication'] = auth;

			PulsarClient.instance = new Pulsar.Client(clientConfig);
		}
		return PulsarClient.instance;
	}
	
	static closeInstance() {
		if (!PulsarClient.instance) {
			PulsarClient.instance.close();
		}
	}
}

export default PulsarClient;