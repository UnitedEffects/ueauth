import { v4 as uuid } from 'uuid';
import { nanoid } from 'nanoid';

const iMocks = {
	invite: {
		'_id': uuid(),
		'createdAt': '2021-08-23T15:51:18.634Z',
		'expiresAt': '2021-09-23T15:51:18.634Z',
		'type': 'owner',
		'__v': 0,
		'sub': 'fe031227-e90b-444b-81cb-29bfc2b64810', //userid
		'authGroup': 'X2lgt285uWdzq5kKOdAOj',
		'status': 'new',
		'xSent': 0,
		'resources': [
			{
				'resourceType': 'group',
				'resourceId': 'X2lgt285uWdzq5kKOdAOj'
			}
		]
	},
	newInvite(rType = 'group', type = 'owner', status = 'new') {
		const out = JSON.parse(JSON.stringify(iMocks.invite));
		out._id = uuid();
		out.authGroup = nanoid(21);
		out.type = type;
		out.status = status;
		out.xSent = Math.floor(Math.random() * 11);
		out.resources[0].resourceType = rType;
		out.resources[0].resourceId = uuid();
		return out;
	},
	invites (count = 10) {
		const output = [];
		for(let i = 0; i<count; i++) {
			output.push(iMocks.newInvite());
		}
		return output;
	}
};

export default iMocks;