import client from '../../../oidc/client/clients';

async function getAuth(Pulsar, params) {
	return new Pulsar.AuthenticationOauth2(params);
}

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
				console.error(error);
				throw new Error('This environment does not support the Pulsar event streaming plugin - the pulsar client is not installed');
			}

			// Assuming Pulsar is set...
			let auth;
			if(provider?.streamAuth === true && provider?.auth?.clientId && provider?.auth?.issuerUrl) {
				const params = {
					issuer_url: provider.auth.issuerUrl,
					scope: 'core:read core:write'
				};
				params['client_id'] = provider.auth.clientId;
				const cl = await client.getOneByAgId(provider?.auth?.rootRef, params.client_id);
				params['client_secret'] = JSON.parse(JSON.stringify(cl)).payload.client_secret;
				params['audience'] = provider?.auth?.audience;
				//if(provider?.auth?.scope) params['scope'] = provider?.auth?.scope;

				try {
					auth = await getAuth(Pulsar, params);
					console.info('Auth Success');
				} catch (error) {
					console.info(error);
				}
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
		if (PulsarClient.instance) {
			PulsarClient.instance.close();
		}
	}
}

export default PulsarClient;