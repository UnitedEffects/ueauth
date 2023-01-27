import Boom from '@hapi/boom';
import {generators} from 'openid-client';
import saml2 from 'ue.saml2-js';
import org from '../../orgs/orgs';
import interactions from './interactions';
import Account from '../../accounts/accountOidcInterface';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import ClientOAuth2 from 'client-oauth2';
import axios from 'axios';

// eslint-disable-next-line no-control-regex
const emailRegex = /(?:[a-z0-9!#$%&'*+=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

const api = {
	getFederationCodesFromAG(authGroup) {
		const agFedCodes = [];
		if(authGroup?.config?.federate) {
			Object.keys(authGroup.config.federate).map((key) => {
				if(authGroup.config.federate[key]) {
					authGroup.config.federate[key].map((connect) => {
						agFedCodes.push({
							code: `${key}.${connect.provider}.${connect.name.replace(/ /g, '_')}`.toLowerCase(),
							upstream: connect.provider,
							button: connect.buttonType,
							text: connect.buttonText
						});
					});
				}
			});
		}
		return agFedCodes;
	},
	validateFedCodeExists(authGroup, code) {
		const codes = api.getFederationCodesFromAG(authGroup);
		const filtered = codes.filter((c) => {
			return (c.code === code);
		});
		return !!filtered.length;
	},
	async establishFedClient(authGroup, upstreamBody, opProvider) {
		let openid, assert_endpoint, sp_options, idp_options;
		const upstream = upstreamBody.split('.');
		const {spec, provider, name, myConfig} = await checkProvider(upstream, authGroup);
		const out = {
			spec,
			provider,
			name,
			myConfig
		};
		if(provider?.toLowerCase().includes('org:')) {
			const org = provider.toLowerCase().split(':');
			if(org.length === 2) {
				out.providerOrg = org[1];
			}
		}
		switch (spec.toLowerCase()) {
		case 'oidc':
			if(!myConfig.client_id) throw Boom.badImplementation('SSO implementation incomplete - missing client id');
			if(myConfig.PKCE === false && !myConfig.client_secret) {
				throw Boom.badImplementation('SSO implementation incomplete - PKCE = false but no client secret is provided');
			}
			out.redirectUri = `${opProvider.issuer}/interaction/callback/${spec.toLowerCase()}/${provider.toLowerCase()}/${name.toLowerCase().replace(/ /g, '_')}`;
			openid = require('openid-client');
			out.issuer = await openid.Issuer.discover(myConfig.discovery_url);
			out.clientOptions = {
				client_id: myConfig.client_id,
				response_types: [myConfig.response_type],
				redirect_uris: [out.redirectUri],
				grant_types: [myConfig.grant_type]
			};
			if(myConfig.PKCE === false) {
				out.clientOptions.client_secret = myConfig.client_secret;
			} else {
				out.clientOptions.token_endpoint_auth_method = 'none';
			}
			out.client = new out.issuer.Client(out.clientOptions);
			return out;
		case 'oauth2':
			if(!myConfig.client_id) throw Boom.badImplementation('SSO implementation incomplete - missing client id');
			if(myConfig.PKCE === false && !myConfig.client_secret) {
				throw Boom.badImplementation('SSO implementation incomplete - PKCE = false but no client secret is provided');
			}
			out.authIssuer = {
				clientId: myConfig.client_id,
				accessTokenUri: myConfig.accessTokenUri,
				authorizationUri: myConfig.authorizationUri,
				scopes: myConfig.scopes
			};
			if(myConfig.PKCE === false) {
				out.authIssuer.clientSecret = myConfig.client_secret;
			} else {
				out.authIssuer.token_endpoint_auth_method = 'none';
			}
			return out;
		case 'saml':
			assert_endpoint = `${opProvider.issuer}/interaction/callback/saml/${myConfig.provider.toLowerCase()}/${myConfig.name.toLowerCase().replace(/ /g, '_')}`;
			sp_options = {
				entity_id:  opProvider.issuer,
				private_key: myConfig.spPrivateKey,
				certificate: myConfig.spCertificate,
				assert_endpoint
			};
			out.sp = new saml2.ServiceProvider(sp_options);
			idp_options = {
				sso_login_url: myConfig.ssoLoginUrl,
				sso_logout_url: myConfig.ssoLogoutUrl,
				certificates: myConfig.idpCertificates,
				sign_get_request: myConfig.signRequest,
				allow_unencrypted_assertion: myConfig.allowUnencryptedAssertion,
				force_authn: myConfig.forceLogin
			};
			out.idp = new saml2.IdentityProvider(idp_options);
			return out;
		default:
			throw Boom.badRequest('unknown specification for SSO requested');
		}
	},
	async federateOidcReq(req, res, authGroup, path, fedError) {
		try {
			const myConfig = req.fedConfig;
			const state = `${req.params.uid}|${crypto.randomBytes(32).toString('hex')}`;
			const nonce = crypto.randomBytes(32).toString('hex');
			setCookie(res, myConfig, 'state', state,{ path, sameSite: 'strict' });
			setCookie(res, myConfig, 'nonce', nonce,{ path, sameSite: 'strict' });

			res.status = 303;
			const authUrlOptions = {
				state,
				nonce,
				scope: `openid ${myConfig.scopes.join(' ')}`.trim()
			};
			if(myConfig.PKCE === true) {
				const code_verifier = generators.codeVerifier();
				const code_challenge = generators.codeChallenge(code_verifier);
				await interactions.savePKCESession({
					payload: {
						state,
						auth_group: req.authGroup.id,
						code_challenge,
						code_verifier
					}
				});
				authUrlOptions.code_challenge = code_challenge;
				authUrlOptions.code_challenge_method = 'S256';
			}

			//because apple is apple
			if(myConfig.provider === 'apple') authUrlOptions.response_mode = 'form_post';

			return res.redirect(req.authClient.authorizationUrl(authUrlOptions));
		} catch (error) {
			console.error('OIDC REQ FUNCTION', error);
			return fedError();
		}
	},
	async federateOidcCb(req, res, authGroup, callbackParams, path, params, fedError) {
		try {
			const myConfig = req.fedConfig;
			const provider = req.provider;
			const callbackUrl = `${provider.issuer}/interaction/callback/oidc/${myConfig.provider.toLowerCase()}/${myConfig.name.toLowerCase().replace(/ /g, '_')}`;
			const state = getCookie(req, myConfig, 'state');
			setCookie(res, myConfig, 'state', null, { path });
			const nonce = getCookie(req, myConfig, 'nonce');
			setCookie(res, myConfig, 'nonce', null, { path });

			if(myConfig.provider.toLowerCase() === 'apple') {
				if(req.body.state !== state) {
					return fedError(`State mismatch. Expected ${state} and received ${req.body.state}`);
				}
				const id_token = req.body.id_token;
				if(id_token) {
					const claims = jwt.decode(id_token, {complete: true});
					const profile = JSON.parse(JSON.stringify(claims.payload));
					if(profile.nonce !== nonce) {
						return fedError(`Nonce mismatch. Expected ${nonce} and received ${profile.nonce}`);
					}
					const account = await Account.findByFederated(authGroup,
						`${req.authSpec}.${myConfig.provider}.${myConfig.name.replace(/ /g, '_')}`.toLowerCase(),
						profile, req.providerOrg);
					const result = {
						login: {
							accountId: account.accountId,
						},
					};
					return provider.interactionFinished(req, res, result, {
						mergeWithLastSubmission: false,
					});
				}
				console.error('Currently, OIDC with Apple requires an id_token response on authorize');
				return fedError('Apple authorization response was unexpected');
			}

			const callbackOptions = {
				state,
				nonce,
				response_type: myConfig.response_type
			};
			if(myConfig.PKCE === true) {
				const session = await interactions.getPKCESession(authGroup.id, state);
				if(!session) {
					return fedError('PKCE session not found');
				}
				callbackOptions.code_verifier = session.payload?.code_verifier;
			}
			const tokenSet = await req.authClient.callback(callbackUrl, callbackParams, callbackOptions);
			const profile = (tokenSet.access_token) ? await req.authClient.userinfo(tokenSet) : tokenSet.claims();
			const account = await Account.findByFederated(authGroup,
				`${req.authSpec}.${myConfig.provider}.${myConfig.name.replace(/ /g, '_')}`.toLowerCase(),
				profile, req.providerOrg);
			const result = {
				login: {
					accountId: account.accountId,
				},
			};

			// saving the original token to pass along to x-federated-token
			if(params.scope.split(' ').includes('federated_token')) {
				if(tokenSet?.access_token) {
					const i = await provider.Interaction.find(req.params.uid);
					i.params.federated_token = tokenSet?.access_token;
					await i.save(authGroup.config.ttl.interaction);
				}
			}

			return provider.interactionFinished(req, res, result, {
				mergeWithLastSubmission: false,
			});
		} catch (error) {
			console.error('OIDC CB FUNCTION', error);
			return fedError();
		}
	},
	async federateOauth2Req(req, res, authGroup, path, fedError){
		try {
			const myConfig = req.fedConfig;
			const callbackUrl = `${req.provider.issuer}/interaction/callback/${req.authSpec.toLowerCase()}/${myConfig.provider.toLowerCase()}/${myConfig.name.toLowerCase().replace(/ /g, '_')}`;
			const state = `${req.params.uid}|${crypto.randomBytes(32).toString('hex')}`;
			setCookie(res, myConfig, 'state', state,{ path, sameSite: 'strict' });

			const oauthOptions = {
				...req.authIssuer,
				redirectUri: callbackUrl,
				state
			};
			if(myConfig.PKCE === true) {
				const code_verifier = generators.codeVerifier();
				const code_challenge = generators.codeChallenge(code_verifier);
				await interactions.savePKCESession({
					payload: {
						state,
						auth_group: authGroup.id,
						code_challenge,
						code_verifier
					}
				});
				oauthOptions.query = {
					code_challenge,
					code_challenge_method: 'S256'
				};
			}
			const issuer = new ClientOAuth2(oauthOptions);
			return res.redirect(issuer.code.getUri());
		} catch(error) {
			console.error('OAUTH REQ FUNCTION', error);
			return fedError();
		}
	},
	async federateOauth2Cb(req, res, authGroup, path, params, fedError){
		try {
			const myConfig = req.fedConfig;
			const provider = req.provider;
			const callbackUrl = `${req.provider.issuer}/interaction/callback/${req.authSpec.toLowerCase()}/${myConfig.provider.toLowerCase()}/${myConfig.name.toLowerCase().replace(/ /g, '_')}`;

			const state = getCookie(req, myConfig, 'state');
			setCookie(res, myConfig, 'state', null, { path });
			setCookie(res, myConfig, 'nonce', null, { path });

			const oauthCallback = {
				...req.authIssuer,
				redirectUri: callbackUrl,
				state
			};
			if (myConfig.PKCE === true) {
				const session = await interactions.getPKCESession(authGroup.id, state);
				if (!session) {
					return fedError('PKCE session not found');
				}
				oauthCallback.body = {
					code_verifier: session.payload.code_verifier
				};
			}
			const issuer = new ClientOAuth2(oauthCallback);
			const tokenset = await issuer.code.getToken(`${callbackUrl}?code=${req.body.code}&state=${req.body.state}`);
			const profResp = await axios({
				method: 'get',
				url: myConfig.profileUri,
				headers: {
					'Authorization': `Bearer ${tokenset.accessToken}`
				}
			});
			if (!profResp.data) {
				return fedError('Unable to retrieve user data from federated provider');
			}
			let profile = JSON.parse(JSON.stringify(profResp.data));
			if (myConfig.provider === 'linkedin') {
				const emailResp = await axios({
					method: 'get',
					url: 'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
					headers: {
						'Authorization': `Bearer ${tokenset.accessToken}`
					}
				});
				if (emailResp && emailResp.data && emailResp.data.elements && emailResp.data.elements.length) {
					const data = emailResp.data.elements[0];
					if (data['handle~'] && data['handle~'].emailAddress) {
						profile.email = data['handle~'].emailAddress;
					}
				}
			}
			if (profile?.data?.id) {
				profile = profile.data;
			}
			if (!profile.id && !profile.sub) {
				console.error('Identities require an ID or Sub property and neither were provided by the provider profile', profile);
				return fedError('User data provided is not compatible with this login');
			}
			if (!profile.email) {
				console.error('Provider did not return an email address. Unique email is required for all auth');
				return fedError('User data provided did not include an email address');
			}
			const account = await Account.findByFederated(authGroup,
				`${req.authSpec}.${myConfig.provider}.${myConfig.name.replace(/ /g, '_')}`.toLowerCase(),
				profile, req.providerOrg);
			const result = {
				login: {
					accountId: account.accountId,
				},
			};

			// saving the original token to pass along to x-federated-token
			if(params.scope.split(' ').includes('federated_token')) {
				if(tokenset?.accessToken) {
					const i = await provider.Interaction.find(req.params.uid);
					i.params.federated_token = tokenset.accessToken;
					await i.save(authGroup.config.ttl.interaction);
				}
			}

			return provider.interactionFinished(req, res, result, {
				mergeWithLastSubmission: false,
			});
		} catch (error) {
			console.error('OAUTH CB FUNCTION', error);
			return fedError();
		}
	},
	async federateSamlReq(req, res, path, samlError) {
		const sp = req.samlSP;
		const idp =	req.samlIdP;
		const myConfig = req.fedConfig;
		const relay_state = `${req.params.uid}|${crypto.randomBytes(32).toString('hex')}`;
		setCookie(res, myConfig, 'state', relay_state, { path, sameSite: 'strict' });

		try {
			const samlReq = await interactions.samlLogin(sp, idp, { relay_state });
			if(!samlReq) throw 'Could not get a login url - this could be a configuration issue';
			return res.redirect(samlReq.loginUrl);
		} catch(err) {
			console.error('Error while trying to initiate login', err);
			return samlError('could not initiate federated SAML login');
		}
	},
	async federateSamlCb(req, res, authGroup, path, samlError) {
		const sp = req.samlSP;
		const idp =	req.samlIdP;
		const provider = req.provider;
		const myConfig = req.fedConfig;

		const state = getCookie(req, myConfig, 'state');
		setCookie(res, myConfig, 'state', null, { path });

		if(state !== req.body.state) {
			console.error(`Unexpected Session State: ${state} vs. ${req.body.state}`);
			return samlError('This does not appear to be the correct browser window');
		}
        
		const options = {request_body: req.body};
        
		let saml_response;
		try {
			saml_response = await interactions.samlAssert(sp, idp, options);
		} catch(err) {
			console.error('No SAML response received', JSON.stringify(err, null, 2));
			return samlError('SAML IdP did not respond');
		}

		const samlId = saml_response.user.name_id || saml_response.user.id;
		const email = (saml_response.user.email) ? saml_response.user.email : (saml_response.user.attributes.email) ?
			(!Array.isArray(saml_response.user.attributes.email)) ? saml_response.user.attributes.email :
				(Array.isArray(saml_response.user.attributes.email) && saml_response.user.attributes.email.length)
					? saml_response.user.attributes.email[0] : null : null;
		if(!email) {
			console.error('SAML responses did not map email');
			return samlError('SAML response does not include email');
		}
		if(!emailRegex.test(email)) {
			console.error('SAML responses email is wrong', email);
			return samlError(`SAML response provided email but it is in the wrong format, '${email}'`);
		}
		const id = (saml_response.user.id) ? (saml_response.user.id) : (saml_response.user.attributes.userId) ?
			(!Array.isArray(saml_response.user.attributes.userId)) ? saml_response.user.attributes.userId :
				(Array.isArray(saml_response.user.attributes.userId) && saml_response.user.attributes.userId.length)
					? saml_response.user.attributes.userId[0] : samlId || email : samlId || email;
		if(!id) {
			console.error('SAML responses did not map a user ID');
			return samlError('SAML response could not identify an ID for the user');
		}
		let account;
		try {
			account = await Account.findByFederated(authGroup,
				`${req.authSpec}.${myConfig.provider}.${myConfig.name.replace(/ /g, '_')}`.toLowerCase(),
				{
					id,
					email,
					idpId: samlId
				}, req.providerOrg);
		} catch (error) {
			return samlError(`Unable to login using federation - ${ error?.message || error}`);
		}

		const result = {
			login: {
				accountId: account.accountId,
			},
		};
		return provider.interactionFinished(req, res, result, {
			mergeWithLastSubmission: false,
		});
	},
	setFederatedReq(req, result) {
		req.providerOrg = result.providerOrg;
		req.authSpec = result.spec;
		req.fedConfig = result.myConfig;
		req.authClient = result.client;
		if(result.spec.toLowerCase() === 'oidc') {
			req.authIssuer = result.issuer;
		}
		if(result.spec.toLowerCase() === 'oauth2') {
			req.authIssuer = result.authIssuer;
		}
		if(result.spec.toLowerCase() === 'saml') {
			req.samlSP = result.sp;
			req.samlIdP = result.idp;
		}
	}
};

function getCookie(req, myConfig, name) {
	return req.cookies[`${myConfig.provider}.${myConfig.name.replace(/ /g, '_')}.${name}`];
}

function setCookie(res, myConfig, name, value, options) {
	return res.cookie(`${myConfig.provider}.${myConfig.name.replace(/ /g, '_')}.${name}`, value, options);
}

async function checkProvider(upstream, ag) {
	if (upstream.length !== 3) throw Boom.badData(`Unknown upstream: ${upstream}`);
	const authGroup = JSON.parse(JSON.stringify(ag));
	const spec = upstream[0];
	const provider = upstream[1];
	const name = upstream[2].replace(/_/g, ' ');
	let organization = undefined;
	if(provider.includes('org:')) {
		const orgId = provider.split(':')[1];
		organization = JSON.parse(JSON.stringify(await org.getOrg(authGroup.id, orgId)));
		if(!authGroup.config.federate) {
			authGroup.config.federate = {};
		}
		if(!authGroup.config.federate[spec]) {
			authGroup.config.federate[spec] = [];
		}
		if(organization?.sso && organization?.sso[spec]){
			organization.sso[spec].provider = provider;
			authGroup.config.federate[spec].push(organization.sso[spec]);
		}
	}
	let agSpecs = [];
	if(authGroup.config && authGroup.config.federate) {
		Object.keys(authGroup.config.federate).map((key) => {
			if(key.toLowerCase() === spec.toLowerCase()) {
				agSpecs = authGroup.config.federate[key];
			}
		});
	}

	if(agSpecs.length === 0) {
		throw Boom.badData(`Unsupported spec ${spec} or provider ${provider}`);
	}

	const option = agSpecs.filter((config) => {
		return (config.provider.toLowerCase() === provider.toLowerCase() && config.name.toLowerCase() === name.toLowerCase());
	});
	if(option.length === 0) throw Boom.badData(`Unsupported provider with name: ${provider}`);
	return { spec, provider, name, myConfig: option[0]};
}

export default api;