import Boom from '@hapi/boom';
import axios from 'axios';

const NAMESPACE = 'core-ueauth';
const TOPIC = 'ueauth-logs';

export default {
	async validateSettings(provider) {
		if(!provider?.adminUrl) throw Boom.badData('Pulsar requires an adminUrl');
		if(!provider?.streamUrl) throw Boom.badData('Pulsar requires a streamUrl - this is your serviceUrl for the pulsar client');
		if(!provider?.setupConfig?.clusterList) throw Boom.badData('Pulsar requires a setupConfig.clusterList array');
		if(!Array.isArray(provider.setupConfig.clusterList)) throw Boom.badData('Pulsar expects clusterList to be an array of strings');
		if(!provider?.setupConfig?.adminRoles) throw Boom.badData('Pulsar requires a setupConfig.adminRoles array, even if its empty');
		if(!Array.isArray(provider.setupConfig.adminRoles)) throw Boom.badData('Pulsar expects adminRoles to be an array, though it can be empty');
		if(provider.clientConfig) {
			const unknownProps = Object.keys(provider.clientConfig).filter((prop) => {
				return (
					prop !== 'operationTimeoutSeconds' &&
                    prop !== 'ioThreads' &&
                    prop !== 'tlsTrustCertsFilePath' &&
                    prop !== 'tlsValidateHostname' &&
                    prop !== 'tlsAllowInsecureConnection'
				);
			});
			if(unknownProps.length > 0) throw Boom.badData(`Unknown client configuration detected: ${unknownProps.join(', ')}`);
		}
	},
	async initializeAG(group, provider) {
		try {
			const tenant = group.id;
			const adminUrl = provider?.adminUrl;
			const tenantAPI = '/admin/v2/tenants';
			const namespaceAPI = `/admin/v2/namespaces/${tenant}`;
			const adminRoles = provider?.setupConfig?.adminRoles;
			const clusterList = provider?.setupConfig?.clusterList;
			const tenantsResponse = await axios({
				method: 'get',
				url: `${adminUrl}${tenantAPI}`
			});
			if(!tenantsResponse?.data) throw new Error('Query to get tenants from pulsar did not work');
			if(!Array.isArray(tenantsResponse.data)) throw new Error('tenants response from pulsar is not an array');
			if(!tenantsResponse.data.includes(tenant)) {
				await axios({
					method: 'put',
					url: `${adminUrl}${tenantAPI}/${tenant}`,
					data: {
						adminRoles,
						clusterList
					}
				});
			}
			const namespaceResponse = await axios({
				method: 'get',
				url: `${adminUrl}${namespaceAPI}`
			});
			if(!namespaceResponse?.data) throw new Error(`Query to get namespaces from pulsar tenant ${tenant} did not work`);
			if(!Array.isArray(namespaceResponse.data)) throw new Error(`namespace response from pulsar tenant ${tenant} is not an array`);
			if(!namespaceResponse.data.includes(NAMESPACE)) {
				await axios({
					method: 'put',
					url: `${adminUrl}${namespaceAPI}/${NAMESPACE}`
				});
			}
		} catch (error) {
			if(error.isAxiosError) console.error(error.response);
			else console.error(error);
			throw Boom.failedDependency(`There is a problem initializing external streaming of audit data for platform ${group.name}. Please try again later. If the problem continues, contact the admin.`);
		}
	},
	async publish(group, emit, provider) {
		let Pulsar;
		try {
			Pulsar = require('pulsar-client');
		} catch (error) {
			throw new Error('This environment does not support the Pulsar event streaming plugin - the pulsar client is not installed');
		}
		// Assume that you can not be here unless Pulsar is installed
		// need one client for the entire runtime
		// need one producer per AG
		console.info(emit);
		const serviceUrl = provider?.streamUrl;
		const clientConffig = {
			serviceUrl,
			...provider?.clientConfig
		};
		// todo Create a client - singleton class or cache
		const client = new Pulsar.Client(clientConffig);

		// todo Create a producer - cache this by AG
		const producer = await client.createProducer({
			topic: `persistent://${group.id}/${NAMESPACE}/${TOPIC}`,
			sendTimeoutMs: 30000,
			batchingEnabled: true,
		});

		// todo - envelope for the events?
		// todo - send can be non-await once we cache producer
		// todo - create conditional where for some events we ack via await and for rest we do not
		const msg = JSON.stringify(emit);
		await producer.send({
			data: Buffer.from(msg),
		});
		// todo only call flush when grabbing the producer from the cache or before you send new messages...
		await producer.flush();

		// todo remove these once cache is in place
		await producer.close();
		await client.close();
	},
	/**
	 *
	 * todo
	async validateSchema() {

	},

	async updateSchema() {

	}
	*/
};