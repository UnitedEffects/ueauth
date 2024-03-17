import { v4 as uuid } from 'uuid';
import { nanoid } from 'nanoid';
const config = require('../../src/config');
const cryptoRandomString = require('crypto-random-string');
const { uniqueNamesGenerator, adjectives, colors, animals } = require('unique-names-generator');

const nMocks = {
	newNotification(processed = false) {
		const randomName = uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals] });
		const authGroup = {
			name: randomName,
			prettyName: randomName,
			id: nanoid()
		};
		const notificationId = uuid();
		const iAccessToken = cryptoRandomString({length: 21, type: 'url-safe'});
		const user = uuid();
		return {
			'_id': notificationId,
			'createdAt': Date.now(),
			'createdBy': uuid(),
			'iss': `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}`,
			'type': 'verify',
			'formats': ['email'],
			'recipientUserId': user,
			'recipientEmail': 'test@unitedeffects.com',
			'recipientSms': '1235555555',
			'authGroupId': authGroup.id,
			'screenUrl': `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}/verifyaccount?code=${iAccessToken}`,
			'subject': `${authGroup.name} - Verify and Claim Your New Account`,
			'message': `You have been added to the authentication group '${authGroup.name}'. Please click the button below or copy past the link in a browser to verify your identity and set your password.`,
			'destinationUri': 'http://localhost:8080', //plugin service
			'processed': processed,
			'meta': {
				description: 'Direct API Patch Call',
				token: iAccessToken,
				apiHeader: `bearer ${iAccessToken}`,
				apiUri: `${config.PROTOCOL}://${config.SWAGGER}/api/${authGroup.id}/user/${user}`,
				apiMethod: 'PATCH',
				apiBody: [
					{
						'op': 'replace',
						'path': '/password',
						'value': 'NEW-PASSWORD-HERE'
					},
					{
						'op': 'replace',
						'path': '/verified',
						'value': true
					}
				]
			},
			'__v': 0
		};
	},
	notifications(count = 10) {
		const out = [];
		for (let i=0; i<count; i++) {
			const temp = JSON.parse(JSON.stringify(nMocks.newNotification()));
			out.push(temp);
		}
		return out;
	}
};

export default nMocks;