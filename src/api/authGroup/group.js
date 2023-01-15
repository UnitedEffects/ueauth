import jsonPatch from 'jsonpatch';
import Boom from '@hapi/boom';
import dal from './dal';
import plugins from '../plugins/plugins';
import helper from '../../helper';
import accounts from '../accounts/account';
import products from '../products/product';
import orgs from '../orgs/orgs';
import k from './generate-keys';
import iat from '../oidc/initialAccess/iat';
import n from '../plugins/notifications/notifications';
import eStreams from '../plugins/eventStream/eventStream';
import ueEvents from '../../events/ueEvents';
import Joi from 'joi';
import cryptoRandomString from 'crypto-random-string';
import domain from "../domains/domain";
import pem from './generate-pem';

const config = require('../../config');

const agp = {
	// @notTested
	async check(pName) {
		const docs = await dal.checkPrettyName(pName);
		return docs === 0;
	},

	async write(body) {
		const data = JSON.parse(JSON.stringify(body));
		// initial write should always be active false
		data.active = false;

		// set expiration date
		data.securityExpiration = new Date(Date.now() + (config.GROUP_SECURE_EXPIRES * 1000));

		// set primary domain
		if (data.primaryDomain) {
			data.primaryDomain = decodeURIComponent(data.primaryDomain);
			if (!data.primaryDomain.includes('://')) {
				data.primaryDomain = `https://${data.primaryDomain}`;
			}
		}

		// if notifications are off
		if (!data?.pluginOptions?.notification || data?.pluginOptions?.notification?.enabled !== true){
			// if no config was set, there is no issue
			if (data.config) {
				// can not have passwordless support without notifications
				data.config.passwordLessSupport = false;
				// can not use requireVerify when there are no notifications and group is public
				if(data.locked === false) {
					data.config.requireVerified = false;
					data.config.autoVerify = false;
				}
			}
		}
		// ensure that external streaming can only be patched after creation
		if (data?.pluginOptions?.externalStreaming?.enabled === true) {
			data.pluginOptions.externalStreaming.enabled = false;
		}

		// mfa Challenge
		if(data.config?.mfaChallenge?.enabled === true) {
			// ensure this is off when first created
			data.config.mfaChallenge.enabled = false;
		}
		const output = await dal.write(data);
		ueEvents.emit(output._id || output.id, 'ue.group.create', output);
		return output;
	},

	async completeGroupSignup (group, globalSettings, owner) {
		const result = JSON.parse(JSON.stringify(group));
		const expiresIn = 86400 + config.GROUP_SECURE_EXPIRES;
		const token = await iat.generateIAT(expiresIn, ['auth_group'], result);
		result.initialAccessToken = token.jti;
		if(result.config) delete result.config.keys;
		if(globalSettings.notifications.enabled === true && config.ROOT_GROUP_REGISTRATION_UI_URL !== undefined){
			try {
				const nOps = agp.groupCreationNotifyOptions(result, owner);
				await n.notify(globalSettings, nOps, result);
			} catch (e) {
				result.warning = {
					message: 'Owner will not get a notification, there was an error',
					info: e.message
				};
			}
		} else result.warning = 'Owner will not get a notification, global settings are not enabled';
		ueEvents.emit(group._id || group.id, 'ue.group.initialize', result);
		return result;
	},

	// @notTested
	async get(q) {
		const query = await helper.parseOdataQuery(q);
		query.projection['config.keys'] = 0;
		query.projection['config.mfaChallenge.meta'] = 0;
		return dal.get(query);
	},

	// @notTested
	async getOne(id) {
		return await dal.getOneByEither(id, false);
	},

	// @notTested
	async deleteOne(id) {
		const result = await dal.deleteOne(id);
		ueEvents.emit(id, 'ue.group.destroy', result);
		return result;
	},

	async deleteOneCleanup(id) {
		const result = await dal.deleteOne(id, true);
		ueEvents.emit(id, 'ue.group.destroy', result);
		return result;
	},

	async getOneByEither(q, onlyIncludeActive=true) {
		return dal.getOneByEither(q, onlyIncludeActive);
	},

	async patch(group, update, user, global) {
		let globalSettings;
		if(!global) {
			globalSettings = await plugins.getLatestPluginOptions(true);
		} else globalSettings = global;
		const patched = jsonPatch.apply_patch(group.toObject(), update);

		// validation for mfaChallenge being enabled
		if(patched.config?.mfaChallenge?.enable === true) {
			if(!patched.config?.mfaChallenge?.type) {
				throw Boom.badRequest('MFA type is required');
			}
			if(globalSettings?.mfaChallenge?.enabled !== true ||
				!globalSettings?.mfaChallenge?.providers) {
				throw Boom.badRequest('Unable to enable MFA until the Admin provides this feature');
			}
			const check = globalSettings.mfaChallenge.providers.filter((p) => {
				return (p.type === patched.config.mfaChallenge.type);
			});
			if(check.length === 0) {
				throw Boom.badRequest(`Unsupported MFA type requested ${patched.config.mfaChallenge.type}`);
			}
		}

		// validation for notifications plugin being enabled
		if(patched?.pluginOptions?.notification?.enabled === true && group?.pluginOptions?.notification?.enabled !== true) {
			if (globalSettings?.notifications?.enabled !== true) {
				throw Boom.methodNotAllowed('The Service Admin has not enabled Global Notifications. ' +
                    'This options is not currently possible for Auth Groups. Contact your admin to activate this feature.');
			}
		}

		// validation for autoVerify being turned on - notification plugin is required
		if(patched.config?.autoVerify === true && patched?.pluginOptions?.notification?.enabled !== true) {
			throw Boom.methodNotAllowed('Automatic account verification requires that you activate or keep active notifications');
		}

		// if notifications are off some options are not available
		if (patched?.pluginOptions?.notification?.enabled !== true){
			// if no config was set, there is no issue
			if (patched.config) {
				// can not have passwordless support without notifications
				if(patched.config.passwordLessSupport === true) {
					throw Boom.methodNotAllowed('You can not set passwordless to true without notifications');
				}
				// can not use requireVerify when there are no notifications and group is public
				if(patched.locked === false) {
					if (patched.config.requireVerified === true || patched.config.autoVerify === true) {
						throw Boom.methodNotAllowed('As a public authGroup, you can not force verification without also enabling notifications');
					}
				}
			}
		}

		// validation and setup for externalStreaming
		if(patched?.pluginOptions?.externalStreaming?.enabled === true &&
			group?.pluginOptions?.externalStreaming?.enabled !== true) {
			if (globalSettings?.eventStream?.enabled !== true) {
				throw Boom.methodNotAllowed('The Service Admin has not enabled external event streaming. ' +
					'This options is not currently possible for Auth Groups. Contact your admin to activate this feature.');
			}
			await eStreams.initializeAG(patched, globalSettings);
		}

		// make sure that if externalStreaming is locked by root, it cannot be deactivated
		if(patched?.pluginOptions?.externalStreaming?.enabled === false &&
			group?.pluginOptions?.externalStreaming?.enabled === true) {
			if (globalSettings?.eventStream?.provider?.lockStreamingOnceActive === true) {
				throw Boom.methodNotAllowed('The service admin has locked the event streaming API. You must contact the admin to disable it.');
			}
		}

		// if SAML has been added, we must issue crt and key for the connection
		if(patched?.config?.federate?.saml && Array.isArray(patched.config.federate.saml) && patched.config.federate.saml.length) {
			const safeSearch = patched.config.federate.saml;
			safeSearch.map((sp, i) => {
				if(!sp.spCertificate || !sp.spPrivateKey) {
					const { pemCert, pemKey } = pem.getPem();
					patched.config.federate.saml[i].spCertificate = pemCert;
					patched.config.federate.saml[i].spPrivateKey = pemKey;
				}
			})
		}

		patched.modifiedBy = user;
		await standardPatchValidation(group, patched);
		const result = await dal.patch(group.id || group._id, patched);
		ueEvents.emit(group.id || group._id, 'ue.group.edit', result);
		return result;
	},

	async switchGroupOwner(group, owner) {
		return dal.switchGroupOwner(group.id || group._id, owner);
	},

	async activateNewAuthGroup(authGroup, account, clientId) {
		const copy = JSON.parse(JSON.stringify(authGroup));
		copy.owner = account._id;
		copy.modifiedBy = account._id;
		copy.active = true;
		copy.__v = authGroup.__v;
		copy.associatedClient = clientId;
		delete copy.securityExpiration;
		const result = await dal.activatePatch(authGroup._id || authGroup.id, copy);
		try {
			await ueEvents.master(authGroup.id || authGroup._id, 'ue.group.initialize', result);
		} catch (error) {
			ueEvents.emit(authGroup.id || authGroup._id, 'ue.group.error', error);
		}
		ueEvents.emit(authGroup.id || authGroup._id, 'ue.group.initialize', result);
		return result;
	},

	// @notTested
	async partialUpdate(id, data) {
		const result = await dal.patchNoOverwrite(id, data);
		ueEvents.emit(id, 'ue.group.edit', result);
		return result;
	},

	async operations(id, operation, user) {
		const userId = user.sub || 'SYSTEM';
		let keys = [];
		let result;
		switch (operation) {
		case 'rotate_keys':
			keys = await k.write();
			if(!keys.length) throw Boom.expectationFailed('Could not rotate keys at this time');
			result = await dal.patchNoOverwrite(id, { modifiedBy: userId, 'config.keys': keys });
			ueEvents.emit(id, 'ue.group.edit', result);
			return result;
		case 'rotate_cookie_keys':
			for(let i=0; i<5; i++) {
				keys.push(cryptoRandomString({length: 10}));
			}
			if(!keys.length) throw Boom.expectationFailed('Could not rotate cookie keys at this time');
			result = await dal.patchNoOverwrite(id, { modifiedBy: userId, 'config.cookieKeys': keys });
			ueEvents.emit(id, 'ue.group.edit', result);
			return result;
		default:
			throw Boom.badData('Unknown operation specified');
		}
	},

	// @notTested
	async updateAliasDns(id, body, user) {
		const update = {
			modifiedBy: user
		};
		const filter = {};
		if(body.aliasDnsUi) {
			update.aliasDnsUi = body.aliasDnsUi;
			filter.$or = [{ aliasDnsUi: { $exists: false }}, { aliasDnsUi: null }];
		}
		if(body.aliasDnsOIDC) {
			update.aliasDnsOIDC = body.aliasDnsOIDC;
			filter.$or = [{ aliasDnsOIDC: { $exists: false }}, { aliasDnsOIDC: null }];
		}
		const result = await dal.patchNoOverwrite(id, update, filter);
		if(!result) throw Boom.notFound(id);
		const output = JSON.parse(JSON.stringify(result));
		delete output.config;
		delete output.pluginOptions;
		ueEvents.emit(id, 'ue.group.edit', output);
		return output;
	},

	// @notTested
	async removeAliasDns(id, user, target) {
		const update = {
			modifiedBy: user
		};
		switch(target) {
		case 'ui':
			update.$unset = { aliasDnsUi: 1 };
			break;
		case 'oidc':
			update.$unset = { aliasDnsOIDC: 1 };
			break;
		default:
			throw Boom.badRequest('Target required');
		}
		const result = await dal.patchNoOverwrite(id, update);
		if(!result) throw Boom.notFound(id);
		const output = JSON.parse(JSON.stringify(result));
		delete output.config;
		delete output.pluginOptions;
		ueEvents.emit(id, 'ue.group.edit', output);
		return output;
	},

	// @notTested
	async getPublicOne(search) {
		return dal.getPublicOne(search);
	},

	// @notTested
	async findByAliasDNS(aliasDnsOIDC) {
		return dal.findByAliasDNS(aliasDnsOIDC);
	},

	// @notTested
	groupCreationNotifyOptions(authGroup, owner) {
		return {
			iss: `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}`,
			createdBy: owner,
			type: 'general',
			formats: ['email'],
			recipientEmail: owner,
			screenUrl: `https://${config.UI_URL}/${authGroup.prettyName}?code=${authGroup.initialAccessToken}`,
			subject: `Your Have Registered a new Platform: ${authGroup.name}`,
			message: `You created a new auth group called '${authGroup.name}'. The button below will take you to your sign-on. If you want to store the URL for later, use: https://${config.UI_URL}/${authGroup.prettyName}`,
			meta: {
				description: 'Direct API Post Call',
				token: authGroup.initialAccessToken,
				apiHeader: `bearer ${authGroup.initialAccessToken}`,
				apiUri: `${config.PROTOCOL}://${config.SWAGGER}/api/${authGroup.id}/user`,
				apiMethod: 'POST',
				apiBody: {
					username: owner,
					email: owner,
					password: 'INSERT-PASSWORD-HERE'
				}
			}
		};
	},
	async returnCoreInfo(ogAg, permissions, ag, query) {
		let core;
		if(permissions?.groupAccess?.includes('super') || permissions?.groupAccess?.includes('client-super')) {
			if(ag === permissions?.core?.group) {
				core = permissions.core;
			} else {
				const coreProducts = await helper.cacheCoreProduct(query.resetCache, ogAg);
				if(coreProducts.length) {
					core = {
						group: ag,
						products: [],
						productCodedIds: []
					}
					coreProducts.map((p) => {
						core.products.push(p.id || p._id);
						core.productCodedIds.push(p.codedId);
					});
				}
			}
		} else if(permissions?.sub_group === ag && permissions?.core?.group === ag) {
			let bFound = false;
			permissions?.core?.productCodedIds?.map((id) => {
				if(bFound === false) {
					permissions?.permissions?.map((p) => {
						if(bFound === false) {
							if(p.includes(`${id}:::group::read:own`) || p.includes(`${id}:::group::read`)) {
								bFound = true;
							}
						}
					})
				}
			});
			if(bFound) {
				core = permissions.core;
			}
		}
		if(core?.org?.id) {
			try {
				const d = await domain.getOrgAdminDomain(ag, core.org.id)
				if(d) core.primaryDomain = JSON.parse(JSON.stringify(d)).id;
			} catch (e) {
				//do nothing
			}
		}
		return core;
	},
	async safeAuthGroup(ag) {
		const authGroup = JSON.parse(JSON.stringify(ag));
		authGroup._id = ag.id;
		const safeAG = JSON.parse(JSON.stringify(ag));
		safeAG._id = ag.id;
		delete safeAG.config;
		delete safeAG.pluginOptions;
		delete safeAG.associatedClient;
		delete safeAG.owner;
		delete safeAG.metadata;
		return { safeAG, authGroup };
	},
	async getAGStats(authGroup) {
		const activeUsers = await accounts.getActiveAccountCount(authGroup);
		const b2bUsers = await accounts.getActiveB2BCount(authGroup);
		const prods = await products.getProductCount(authGroup);
		const organizations = await orgs.getOrgCount(authGroup);
		return {
			activeUsers,
			b2bUsers,
			products: prods,
			organizations
		}
	}
};

async function standardPatchValidation(original, patched) {
	const definition = {
		createdAt: Joi.any().valid(original.createdAt).required(),
		modifiedAt: Joi.any().required(),
		modifiedBy: Joi.string().required(),
		_id: Joi.string().valid(original._id).required(),
		associatedClient: Joi.string().valid(original.associatedClient).required()
	};
	if(original.securityExpiration) {
		definition.securityExpiration = Joi.any().valid(original.securityExpiration).required();
	}
	if(patched.aliasDnsUi !== original.aliasDnsUi) {
		throw Boom.badRequest('aliasDnsUi cannot be edited form this API');
	}
	if(patched.aliasDnsOIDC !== original.aliasDnsOIDC) {
		throw Boom.badRequest('aliasDnsOIDC cannot be edited form this API');
	}

	const groupSchema = Joi.object().keys(definition);
	const main = await groupSchema.validateAsync(patched, {
		allowUnknown: true
	});
	if(main.error) throw main.error;
}

export default agp;