const forge = require('node-forge');
const config = require('../../config');
forge.options.usePureJavaScript = true;

const makeNumberPositive = (hexString) => {
	let mostSignificativeHexDigitAsInt = parseInt(hexString[0], 16);
	if (mostSignificativeHexDigitAsInt < 8) return hexString;
	mostSignificativeHexDigitAsInt -= 8;
	return mostSignificativeHexDigitAsInt.toString() + hexString.substring(1);
};

const randomSerialNumber = () => {
	return makeNumberPositive(forge.util.bytesToHex(forge.random.getBytesSync(20)));
};

// Get the Not Before Date for a Certificate (will be valid from 2 days ago)
const getCertNotBefore = () => {
	let twoDaysAgo = new Date(Date.now() - 60*60*24*2*1000);
	let year = twoDaysAgo.getFullYear();
	let month = (twoDaysAgo.getMonth() + 1).toString().padStart(2, '0');
	let day = twoDaysAgo.getDate();
	return new Date(`${year}-${month}-${day} 00:00:00Z`);
};

// Get CA Expiration Date (Valid for 100 Years)
const getCANotAfter = (notBefore) => {
	let year = notBefore.getFullYear() + 100;
	let month = (notBefore.getMonth() + 1).toString().padStart(2, '0');
	let day = notBefore.getDate();
	return new Date(`${year}-${month}-${day} 23:59:59Z`);
};

export default {
	getPem() {
		const DEFAULT_C = 'United States';
		const DEFAULT_ST = 'Pennsylvania';
		const DEFAULT_L = 'Philadelphia';

		const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair(2048);
		const cert = forge.pki.createCertificate();

		const attributes = [{
			shortName: 'C',
			value: DEFAULT_C
		}, {
			shortName: 'ST',
			value: DEFAULT_ST
		}, {
			shortName: 'L',
			value: DEFAULT_L
		}, {
			shortName: 'CN',
			value: config.ROOT_COMPANY_NAME
		}];

		const extensions = [{
			name: 'basicConstraints',
			cA: true
		}, {
			name: 'keyUsage',
			keyCertSign: true,
			cRLSign: true
		}];

		cert.publicKey = publicKey;
		cert.privateKey = privateKey;
		cert.serialNumber = randomSerialNumber();
		cert.validity.notBefore = getCertNotBefore();
		cert.validity.notAfter = getCANotAfter(cert.validity.notBefore);
		cert.setSubject(attributes);
		cert.setIssuer(attributes);
		cert.setExtensions(extensions);

		cert.sign(privateKey, forge.md.sha512.create());

		const pemCert = forge.pki.certificateToPem(cert);
		const pemKey = forge.pki.privateKeyToPem(privateKey);
		return { pemCert, pemKey };
	}
};