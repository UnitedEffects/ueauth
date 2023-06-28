import oidc from '../oidc';
import authgroup from '../../authGroup/group';

export default {
	/**
	 * This is a temporary function to work out the flow. This will be deleted shortly.
	 * @returns {Promise<void>}
	 */
	async defineToken (authGroup, organization, clientId, exp) {
		const ag = await authgroup.getOne(authGroup);
		const provider = new oidc(ag);
		const client = await provider.Client.find(clientId);
		const token = new provider.ClientCredentials({
			client,
			expiresIn: exp,
			scope: `access group:${authGroup} org:${organization}`
		});
		await token.save();
		console.info('post-save', token);
	}
};