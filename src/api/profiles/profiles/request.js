import axios from 'axios';
import Boom from '@hapi/boom';
import dal from '../dal';
import sp from './profile';
import op from './org';
import snap from './snap';
import view from './view';
import ueEvents from '../../../events/ueEvents';
import helper from '../../../helper';

const config = require('../../../config');

export default {
	async createRequest(data) {
		const result = await dal.createRequest(data);
		ueEvents.emit(data.authGroup, 'ue.secured.profile.access.requested', result);
		if(result.type === 'copy') {
			await snap.takeSnap(result.authGroup, result.targetAccountId, result.id, result.requestingAccountId, undefined);
		}
		return result;
	},
	// this is limited to your requests... if we want a broader query, we will need permissions defined for this API
	async getMyRequests(authGroup, q, target, sender) {
		const query = await helper.parseOdataQuery(q);
		return dal.getRequests(authGroup, query, target, sender);
	},
	async getRequest(authGroup, id, user) {
		return dal.getRequest(authGroup, id, user);
	},
	async deleteRequest(authGroup, id, user) {
		return dal.deleteRequest(authGroup, id, user);
	},
	async updateRequestStatus(authGroup, id, state, target) {
		const result = await dal.updateRequestStatus(authGroup, id, state, target);
		if(!result) throw Boom.notFound(`Request not found: ${id}`);
		switch (state) {
		case 'approved':
			ueEvents.emit(authGroup, 'ue.secured.profile.access.approved', result);
			switch (result?.type) {
			case 'sync':
				await setSync(authGroup, target, result);
				break;
			case 'access':
				await setAccess(result);
				break;
			case 'copy':
				await setCopy(authGroup, target, result);
				break;
			default:
				break;
			}
			break;
		case 'denied':
			ueEvents.emit(authGroup, 'ue.secured.profile.access.denied', result);
			if(result.type === 'sync') {
				await snap.deny(authGroup, result.id, target);
			}
			break;
		default:
			break;
		}
		return result;
	}
};

async function setAccess(result) {
	const accessObject = {
		authGroup: result.authGroup,
		viewingAccountId: result.requestingAccountId,
		viewingEmail: result.requestingEmail,
		accessDetails: result.requestDetails,
		targetAccountId: result.targetAccountId
	};
	if(result.accessExpirationTime !== 'unlimited') {
		const exDate = new Date();
		const days = parseInt(result.accessExpirationTime);
		accessObject.expiresAt = exDate.setDate(exDate.getDate() + days);
	}
	console.info(accessObject);
	return view.createView(accessObject);
}

async function setSync(authGroup, target, result) {
	if(result.orgId) {
		const profile = await sp.getProfile(authGroup, target);
		if(profile) {
			return op.syncProfile(authGroup, result.orgId, profile, target);
		}
	}
	return null;
}

async function setCopy(authGroup, target, result) {
	const profile = await sp.getProfile(authGroup, target);
	let snapshot = await snap.addSnapShot(authGroup, result.id, target, profile);
	if(!snapshot) {
		snapshot = await snap.takeSnap(authGroup, target, result.id, result.requestingAccountId, profile);
	}
	if(result.dataCallback) {
		const data = JSON.parse(JSON.stringify(profile));
		data.terms = {
			confidential: 'This data is private and confidential',
			message: `This data is intended solely for use by email or id ${result.requestingEmail || result.requestingAccountId} with intent specified as: ${result.requestDetails}. Any use of this data beyond this stated intent, or sharing of this data beyond the system this request is targeting, is a breach of access and security. Security breaches are the liability and responsibility of the receiver of this request. If you have received this data by mistake, you are required to delete the information from your servers.`,
			liability: `By approving and transmitting this data, the account holder has waived all liability and responsibility of ${authGroup.name} and ${config.ROOT_COMPANY_NAME} as it relates to this data and its transmission.`
		};
		const options = {
			url: result.dataCallback,
			method: 'post',
			data
		};
		try {
			await axios(options);
		} catch (error) {
			console.error(error);
		}
	}
	return snapshot;
}