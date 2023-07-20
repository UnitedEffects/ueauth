import oidc from '../oidc';
import Boom from '@hapi/boom';
import client from '../client/clients';
import ueEvents from '../../../events/ueEvents';
import helper from '../../../helper';
import dal from './dal';

function translateToKeyService(q) {
	Object.keys(q).map((k) => {
		switch(k) {
		case 'organizationId':
			q.initialized_org_context = q.organizationId
			delete q.organizationId;
			break;
		case 'authGroup':
			q.auth_group = q.authGroup;
			delete q.authGroup;
			break;
		case 'clientId':
			q.client_id = q.clientId;
			delete q.clientId;
			break;
		case 'productId':
			q.associated_product = q.productId;
			delete q.productId;
			break;
		case 'name':
			q.client_name = q.name;
			delete q.name;
			break;
		default:
			break;
		}
	});
	return q;
}

export default {
	async initializeProductKeyClient(authGroup, productName, data) {
		const options = {
			name: `KEYS - ${productName} ${data.name}`,
			label: 'product-key',
			productId: data.productId,
			organizationId: data.organizationId,
			introspectionEndpointAuthMethod: 'none',
			revocationEndpointAuthMethod: 'none',
			tokenEndpointAuthMethod: 'none'
		};
		const result = await client.createProductKeyService(authGroup, options);
		const output = {
			clientId: result.client_id,
			name: result.client_name,
			label: result.client_label,
			organizationId: result.initialized_org_context,
			productId: data.productId
		};
		ueEvents.emit(authGroup.id, 'ue.key.access.defined', { type: 'Product Key Service', ...output});
		return output;
	},
	async showProductKeyClients(authGroup, product, query) {
		query.query = translateToKeyService(query.query);
		return client.getProductKeys(authGroup, product, query);
	},
	async removeProductKeyClient(authGroupId, productId, clientId, orgContext) {
		const result = await client.deleteProductKeyService(authGroupId, productId, clientId, orgContext);
		//if(result) ueEvents.emit(authGroupId, 'ue.key.access.destroy', { clientId });
		return result;
	},
	async getProductKeyClient(authGroupId, productId, clientId) {
		return client.getProductKeyService(authGroupId, productId, clientId);
	},
	async createKey(authGroup, product, data, orgContext = undefined) {
		let value;
		try {
			const provider = await oidc(authGroup);
			const cl = await provider.Client.find(data.clientId);
			if(cl?.associated_product !== product) throw Boom.notFound('Service is not associated to the product specified');
			let scope = `access group:${authGroup.id}`;
			if(orgContext && orgContext !== cl?.initialized_org_context) {
				throw Boom.forbidden('Your permissions are not for this organization');
			}
			if(cl?.initialized_org_context) scope = `${scope} org:${cl.initialized_org_context}`;
			const token = new provider.ClientCredentials({
				client: cl,
				expiresIn: data.expires,
				scope
			});
			value = await token.save();
			const key = {
				...data,
				key: value,
				productId: product,
				authGroup: authGroup.id,
				clientId: cl.clientId
			};
			if(cl.initialized_org_context) key.organizationId = cl.initialized_org_context;
			const result = await dal.createKey(key);
			const event = JSON.parse(JSON.stringify(result));
			delete event.key;
			ueEvents.emit(authGroup.id, 'ue.key.access.defined', event);
			return result;
		} catch (error) {
			if(value) await dal.removeClientCredential(value, data.clientId);
			throw error;
		}
	},
	async getKeys(authGroup, product, q, orgContext = undefined) {
		const query = await helper.parseOdataQuery(q);
		query.query.authGroup = authGroup;
		query.query.product = product;
		if(orgContext) query.query.organizationId = orgContext;
		return dal.getKeys(query);
	},
	async getKey(authGroup, product, id, orgContext = undefined) {
		return dal.getKey(authGroup, product, id, orgContext);
	},
	async removeKey(authGroup, product, id, orgContext = undefined) {
		const result = await dal.removeKey(authGroup, product, id, orgContext);
		if(result?.id) ueEvents.emit(authGroup, 'ue.key.access.destroy', { name: result.name, id: result._id});
		return result;
	},
	async refreshKey(authGroup, product, id, orgContext = undefined) {
		const provider = await oidc(authGroup);
		const record = await dal.getKey(authGroup.id, product, id, orgContext);
		if(!record) throw Boom.notFound(id);
		if(record?.key) {
			try {
				const token = await provider.ClientCredentials.find(record.key);
				await token.destroy();
			} catch (error) {
				// this is cleanup
			}
		}
		const cl = await provider.Client.find(record.clientId);
		let scope = `access group:${authGroup.id}`;
		if(cl.initialized_org_context) scope = `${scope} org:${cl.initialized_org_context}`;
		const token = new provider.ClientCredentials({
			client: cl,
			expiresIn: record.expires,
			scope
		});
		const value = await token.save();
		record.key = value;
		const result = await record.save();
		const event = JSON.parse(JSON.stringify(result));
		delete event.key;
		ueEvents.emit(authGroup.id, 'ue.key.access.refreshed', event);
		return result;
	},
};