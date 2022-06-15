

class PulsarClient {
	constructor() {
		throw new Error('Use PulsarClient.getInstance()');
	}

	static getInstance(provider) {
		if (!PulsarClient.instance) {
			let Pulsar;
			try {
				Pulsar = require('pulsar-client');
			} catch (error) {
				throw 'This environment does not support the Pulsar event streaming plugin - the pulsar client is not installed';
			}
			const clientConfig = {
				serviceUrl: provider?.streamUrl,
				...provider?.clientConfig
			};
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