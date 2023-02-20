import axios from 'axios';
import { nanoid } from 'nanoid';
import crypto from 'crypto-js';

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
	console.info('Auth header: ' + result);
	return result;
}

function getUTCTimeStamp() {
	const now = new Date();
	const utcTimestamp = Date.UTC(now.getUTCFullYear(),now.getUTCMonth(), now.getUTCDate() ,
		now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds());
	return utcTimestamp;
}

function calculateHmac(data, secretKey) {
	console.info(`calculating hmac from data: '${data} \nsecretKey: ${secretKey}`);
	const hmac = crypto.HmacSHA256(data, secretKey);
	return hmac.toString(crypto.enc.Base64);
}

function generateHmac(id, key, method, route, postbody) {
	const identifier = id;
	const secretKey = key;
	console.info(`input: id ${identifier}, key ${secretKey}, route ${route}, method ${method}, body ${postbody}`);
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
	console.info('signature:' + signature);
	return constructAuthHeader(identifier, timestamp, signature);
}

export default {
	async createCompany(id, key, groupId) {
		const url = `${API.domain}${API.createCompany}`;
		const method = 'POST';
		const data = {
			name: `${groupId}_${nanoid(6)}`
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
		console.info(result.status);
		console.info(result.headers);
		return { status: result.status, data: result.headers };
	},
	async createAppSpace() {

	},
	async createReqOrigin() {

	},
	async createAccessKey() {

	},
	async addCallback() {

	}
};