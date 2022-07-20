import Boom from '@hapi/boom';
import axios from 'axios';
import Client from './clientSingleton';
import Producers from './producers';
import cl from '../../../oidc/client/clients';

const NAMESPACE = 'core-ueauth';
const TOPIC = 'ueauth-logs';

const pulsarProducers = new Producers();

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
			let token;
			if(provider?.restAuth === true) {
				const client = await cl.getOneByAgId(group.id||group._id, provider?.auth?.clientId);
				const tokReq = await cl.generateClientCredentialToken(
					group.id||group._id, client, provider?.auth?.scope, provider?.auth?.audience);
				token = tokReq?.data?.access_token;
			}
			const tenant = group.id || group._id;
			const adminUrl = provider?.adminUrl;
			const tenantAPI = '/admin/v2/tenants';
			const namespaceAPI = `/admin/v2/namespaces/${tenant}`;
			const adminRoles = provider?.setupConfig?.adminRoles;
			const clusterList = provider?.setupConfig?.clusterList;
			const tenantOptions = {
				method: 'get',
				url: `${adminUrl}${tenantAPI}`
			};
			if(token) tenantOptions.headers = {
				'authorization': `bearer ${token}`
			};
			const tenantsResponse = await axios(tenantOptions);
			if(!tenantsResponse?.data) throw new Error('Query to get tenants from pulsar did not work');
			if(!Array.isArray(tenantsResponse.data)) throw new Error('tenants response from pulsar is not an array');
			if(!tenantsResponse.data.includes(tenant)) {
				const tenantSetOptions = {
					method: 'put',
					url: `${adminUrl}${tenantAPI}/${tenant}`,
					headers: {
						'content-type': 'application/json'
					},
					data: JSON.stringify({
						adminRoles,
						allowedClusters: clusterList
					})
				};
				if(token) {
					tenantSetOptions.headers.authorization = `bearer ${token}`;
				}
				const result = await axios(tenantSetOptions);
			} else console.info('Tenant already exists');

			const getNameSpace = {
				method: 'get',
				url: `${adminUrl}${namespaceAPI}`
			};
			if(token) {
				getNameSpace.headers = {
					'authorization': `bearer ${token}`
				};
			}
			const namespaceResponse = await axios(getNameSpace);
			if(!namespaceResponse?.data) throw new Error(`Query to get namespaces from pulsar tenant ${tenant} did not work`);
			if(!Array.isArray(namespaceResponse.data)) throw new Error(`namespace response from pulsar tenant ${tenant} is not an array`);
			if(!namespaceResponse.data.includes(`${tenant}/${NAMESPACE}`)) {
				const namespaceSetOptions = {
					method: 'put',
					headers: {
						'content-type': 'application/json'
					},
					url: `${adminUrl}${namespaceAPI}/${NAMESPACE}`
				};
				if(token) {
					namespaceSetOptions.headers.authorization = `bearer ${token}`;
				}
				await axios(namespaceSetOptions);
			} else console.info('namespace already exists');
		} catch (error) {
			if(error.isAxiosError) {
				console.error(error.response);
			}
			else console.error(error);
			throw Boom.failedDependency(`There is a problem initializing external streaming of audit data for platform ${group.name}. Please try again later. If the problem continues, contact the admin.`);
		}
	},
	async publishMaster(group, emit, provider) {
		if(provider.masterStream?.enabled === true &&
			provider.masterStream?.streamPath) {
			const topic = provider.masterStream.streamPath;
			let client;
			try {
				client = await Client.getInstance(provider);
			} catch (error) {
				console.info(error);
			}
			const producer = await pulsarProducers.find(`master-${group.id}`, client, topic);
			const msg = JSON.stringify(emit);
			return producer.send({
				data: Buffer.from(msg),
			});
		}
	},
	async publish(group, emit, provider) {
		const topic = `persistent://${group.id}/${NAMESPACE}/${TOPIC}`;
		let client;
		try {
			client = await Client.getInstance(provider);
		} catch (error) {
			console.info(error);
		}
		const producer = await pulsarProducers.find(group.id, client, topic);
		const msg = JSON.stringify(emit);
		console.info(`streaming --> ${JSON.stringify(emit, null, 2)}`);
		producer.send({
			data: Buffer.from(msg),
		});
	}
};