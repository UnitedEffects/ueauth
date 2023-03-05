import axios from 'axios';
import crypto from 'crypto-js';
import Boom from '@hapi/boom';

const config = require('../../../../config');
const API = {
	domain: 'https://cloud.privakey.com',
	createCompany: '/admin/api/companies/new',
	createAppSpace: '/admin/api/companies/{{companyGuid}}/appSpaces/new',
	createReqOrigin: '/admin/api/companies/{{companyGuid}}/appSpaces/{{appSpaceGuid}}/requestOrigins/new',
	createGenKey: '/admin/api/companies/{{companyGuid}}/appSpaces/{{appSpaceGuid}}/requestOrigins/{{requestOriginGuid}}/keyManagement',
	addCallback: '/admin/api/companies/{{companyGuid}}/appSpaces/{{appSpaceGuid}}/requestOrigins/{{requestOriginGuid}}/callbacks/new'
};

function constructAuthHeader(identifier, timestamp, signature) {
	const intraHeaderDelimiter = ',';
	const intraCredentialsDelimiter = '/';
	const result = 'CX1-HMAC-SHA256' +
        intraHeaderDelimiter +
        identifier +
        intraCredentialsDelimiter +
        timestamp +
        intraHeaderDelimiter +
        signature;
	return result;
}

function getUTCTimeStamp() {
	const now = new Date();
	const utcTimestamp = Date.UTC(now.getUTCFullYear(),now.getUTCMonth(), now.getUTCDate() ,
		now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds());
	return utcTimestamp;
}

function calculateHmac(data, secretKey) {
	const hmac = crypto.HmacSHA256(data, secretKey);
	return hmac.toString(crypto.enc.Base64);
}

function generateHmac(id, key, method, route, postbody) {
	const identifier = id;
	const secretKey = key;
	let dataToSign;
	const timestamp = getUTCTimeStamp();
	let signature;

	if (method == 'GET') {
		dataToSign = method + route + timestamp + identifier;
		signature = calculateHmac(dataToSign, secretKey);
	} else {
		//Check the body w/the signature
		dataToSign = method + route + timestamp + identifier + postbody;
		signature = calculateHmac(dataToSign, secretKey);
	}
	return constructAuthHeader(identifier, timestamp, signature);
}

export default {
	async createCompany(id, key, name) {
		const url = `${API.domain}${API.createCompany}`;
		const method = 'POST';
		const data = {
			name: (config.ENV !== 'production') ? `TEST ${name}` : name
		};
		const hmac = generateHmac(id, key, method, url, JSON.stringify(data));
		const options = {
			url,
			method,
			headers: {
				'Content-Type': 'application/json',
				authorization: hmac
			},
			data
		};
		const result = await axios(options);
		if(!result?.headers?.location) throw Boom.failedDependency('Could not create a company');
		const location = result.headers.location.split('/');
		return { status: result.status, id: location[location.length-1], name: data.name };
	},
	async createAppSpace(id, key, name, cId, logo) {
		const url = `${API.domain}${API.createAppSpace}`.replace('{{companyGuid}}', cId);
		const method = 'POST';
		const data = {
			idpType: 'simple',
			name,
			brandInfo: {
				url: logo,
				color: '#F0B700'
			},
			useUniversalApp: true
		};
		const hmac = generateHmac(id, key, method, url, JSON.stringify(data));
		const options = {
			url,
			method,
			headers: {
				'Content-Type': 'application/json',
				authorization: hmac
			},
			data
		};
		const result = await axios(options);
		if(!result?.headers?.location) throw Boom.failedDependency('Could not create an app space');
		const location = result.headers.location.split('/');
		return { status: result.status, id: location[location.length-1] };
	},
	async createReqOrigin(id, key, groupId, cId, aId) {
		const name = `${groupId}_origin`;
		const url = `${API.domain}${API.createReqOrigin}`
			.replace('{{companyGuid}}', cId)
			.replace('{{appSpaceGuid}}', aId);
		const method = 'POST';
		const data = {
			name
		};
		const hmac = generateHmac(id, key, method, url, JSON.stringify(data));
		const options = {
			url,
			method,
			headers: {
				'Content-Type': 'application/json',
				authorization: hmac
			},
			data
		};
		const result = await axios(options);
		if(!result?.headers?.location) throw Boom.failedDependency('Could not create an origin');
		const location = result.headers.location.split('/');
		return { status: result.status, id: location[location.length-1] };
	},
	async createAccessKey(id, key, groupId, cId, aId, oId) {
		const url = `${API.domain}${API.createGenKey}`
			.replace('{{companyGuid}}', cId)
			.replace('{{appSpaceGuid}}', aId)
			.replace('{{requestOriginGuid}}', oId);
		const method = 'POST';
		const data = {
			keyType: 'basic'
		};
		const hmac = generateHmac(id, key, method, url, JSON.stringify(data));
		const options = {
			url,
			method,
			headers: {
				'Content-Type': 'application/json',
				authorization: hmac
			},
			data
		};
		const result = await axios(options);
		if(!result?.data?.key) throw Boom.failedDependency('Could not complete the transaction to issue key for origin');
		return { status: result.status, data: { id: oId, key: result.data.key} };
	},
	async addCallback(id, key, groupId, cId, aId, oId) {
		const url = `${API.domain}${API.addCallback}`
			.replace('{{companyGuid}}', cId)
			.replace('{{appSpaceGuid}}', aId)
			.replace('{{requestOriginGuid}}', oId);
		const method = 'POST';
		const data = {
			callbackUrl: `${config.SWAGGER}/api/{*}/mfa/callback`
		};
		const hmac = generateHmac(id, key, method, url, JSON.stringify(data));
		const options = {
			url,
			method,
			headers: {
				'Content-Type': 'application/json',
				authorization: hmac
			},
			data
		};
		const result = await axios(options);
		if(!result?.headers?.location) throw Boom.failedDependency('Could not create a callback');
		const location = result.headers.location.split('/');
		return { status: result.status, id: location[location.length-1] };
	},
	async addWebAuthNCallback(id, key, groupId, cId, aId, oId, domain) {
		const url = `${API.domain}${API.addCallback}`
			.replace('{{companyGuid}}', cId)
			.replace('{{appSpaceGuid}}', aId)
			.replace('{{requestOriginGuid}}', oId);
		const method = 'POST';
		const data = {
			callbackUrl: (domain.includes('localhost')) ? 'localhost' : domain,
			type: 'webauthn'
		};
		const hmac = generateHmac(id, key, method, url, JSON.stringify(data));
		const options = {
			url,
			method,
			headers: {
				'Content-Type': 'application/json',
				authorization: hmac
			},
			data
		};
		const result = await axios(options);
		if(!result?.headers?.location) throw Boom.failedDependency('Could not create a callback');
		const location = result.headers.location.split('/');
		return { status: result.status, id: location[location.length-1] };
	},
};