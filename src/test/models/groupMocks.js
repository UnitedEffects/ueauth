import { nanoid } from 'nanoid';
const config = require('../../config');
const { uniqueNamesGenerator, adjectives, colors, animals } = require('unique-names-generator');

const agMocks = {
	group: {
		'_id': 'X2lgt285uWdzq5kKOdAOj',
		'config': {
			'ttl': {
				'accessToken': 3600,
				'authorizationCode': 600,
				'clientCredentials': 3600,
				'deviceCode': 3600,
				'idToken': 3600,
				'refreshToken': 86400,
				'interaction': 3600,
				'session': 864000,
				'grant': 864000
			},
			'keys': [
				{
					'e': 'AQAB',
					'n': 'x6-9R60xsM9Pz2E3INrgR6qHfWc3d6OsGdksxcWZCQ5MwZk1D3113a-cQc7qYmrOXZ-uovLGCKlD--xbsx1dbEiUhwHQLIjX-LSrw2JGQTBdbZWIX98Hv139pKL8dzsA6G8YHOTSnSVdtSBV5esmeN_bTHzJugvMVDAJpwJi-TtPuv8M03n-OuRGx_fRtBmf1D5VazthEMtCkd-3NxEz9WBBBNiwrwGy7I4vaF-peRRpYU4UyTzeL6gQIfzRlP2XyTYg9i6HhxNCo_t7AB9m2XKFVcecoj9bmWnKrtvEhDUomjg3CBME4tcAVGkclrynFF7hSfEaT-YXbiXsID3jrw',
					'd': 'IFWAnL6asTqgfcAMITHP50rhrZitDp5eG8Fi0pNweFrsatzYDq4OC9uHvdA3e8A3sklNCe2ty3E9JOnc31_95K7L_iB5CP0Pm6IFvhmHrr6aIkh4UK3Yn1Ak5ifOIbBYMUrr6KHUyMVoKxAVWKl_DUuSQwxhzdJjP66XoYdtZ1W9_ldA33mZEHmxIeWdKI_hCRdfSEygtF8vW3tzuoiv17J95d6OUNQwuyKAxDrXMkjbnZBeaD_fkj6aHXMLEZ0VStjR7RLzz4g0IGxixWisq9Sjbb9L_5znuXU80tb1phIm1xmwT72ETi_QHttHpEtkJNmSF7rOIrBExJlG4F_0IQ',
					'p': '7d8G6rTvqeFQ0On16C3tjmofzRpgpm3-rIH2vfIJtKpT02swtpM5_arOzjwqBOVe9jem3Yj71Lxg_d0v1dgXow09dIjRJiocbo3StSl-o_Qi-5gk97aBKXW4JVtH3EjcNo6gT3e9POz-1xVYwp1RGgABDbHoWqyvhsB3acTO4TU',
					'q': '1ue2JmVOx4OteaPysFjLcD7Ii_2U8HStbMttetBbfJUA6CO6mJE__8RSuqdYlnYuHmHQOgjPqQBM2jRFr33JhDkrmqBjoZGNqFwCSnme4LNLgM5DXKw6Tca_GZm8CX9hgvMq4UHXRpF8uaJfB94ir-iEQcJfpSl5vQuFgv4m0dM',
					'dp': 'gf1NJFn4VpeguGoCTf07QoZQFp-BjbGyaMck9awdDbO-11xOZJeUK0F6fk12kPJfsKG8-HdxV1ISluiWyX-rexkzKknSMc71dpzeNs4UPLifnWoJWa1MbEG-ffuiC4ltfgr3JDZFHdRNd3Bc7w1VUqYJ7Vf5qAOScEshdpVskLk',
					'dq': 'orYFf8SshPr52WN8WHCid3XRucxhfD2bIQhU9-vRmN3oNdr3aJRw9GHckV4rAKCyAmbklUwejkKf7YYuTNTcQrRWg1h0ltvxeUtQoLq8xDx8KiYBcqUj78dO4T8406gSWGdsS-jh6Zg16wc5FGfns3BE0tUsPYzNk4ipqahsE-k',
					'qi': 'n8SHm5iTkmO7VkJ_wBzvO8blWSe_nYhhkBxXhNbFHS7KI-A6Es_4h_GgVTe_IHka-afnUbPb5WGQP2Pdvf8TAB16bTWIN7Orqa14dywlkwwTL9rmJt43wxlIOJ4LBo_HuYN5NIMgGfgI13_8XWkS8sghfUFgiYmqipXxKGMKMvM',
					'kty': 'RSA',
					'kid': 'oaoM7Od_nwtt_tWanSc8S9KnTyKFOFOH_FP0R9uprs0',
					'use': 'sig'
				},
				{
					'e': 'AQAB',
					'n': '2wjLO5_DpqV2xD8QWndMG02QDaotqXd4H63NbWvIDrjGe_tJrr-8jnf82pnwUwIMG9ngC6klotzgBMhd0vfcnctmAg6lBITY0tZDsLesCjAtVtO3mJryeXtgCz7uMq2VeQ1lCtUGwUvgqcIm42iQItBH3ZIhDuCVRVhZ-aGE11ShZD6WqogAfYm1BZYZHl3VKHszo9Smpr7YX2PxdG_ZvmqpFpr37AUCeBDVVPGAjStXvPAhcgMfIFMP5pDeW8pFSJvQNjy0dCeYoyxEW8onX9EUkqhYxPI2uy8BsVvENFmXGx75YtBI1F-gIq1kR8e32NfeHYXeSZ6CS3AbzqrUyw',
					'd': 'INEJeg5uxtoFmFOGhLdY_MI7MgDsRHa01bI5lApQ9_uxKUQ1_uuVOZc6mBn2SsmEvOuAyN532BXVroHCpOgj8rRVvTsqeCnbPoOBssliCki7kkW4PTIB4Dee5TBxicA-I9vg5qWSFIXkzCpdnza8WarxCX5qW4tEchZRrLgJaiVpu9ZSxE5iQFzTFFPjOeiKfNvbnOpbJuLzKl4oQiAasfUQt1ybqyZvYicysCFxb56BzpWbH9JLtAuIPOKkpL33QxnXklTKuRWu5L_W3a_gQXRrbUZhWGRHTDBdHkqf01I7E5rL9Nrb5oWsqlNl4HLqk_9bHUo_KUHrbRIS0BZyUQ',
					'p': '_2utp7lSxsIsUCEG1pvBy0ZIQVp6VoRhslKQIvYn2WCEGUHip8KchlJuCo0fUokfjUIQdCRSx8eRKaZiUD1qfm6kCujleVFozRXoxdNUgZlmM2vYTEdAydL7h2jV4yczejEPBPvsMS5xp9yV--PC1eHKTaUAlcPwVlDGMc0qQ2M',
					'q': '24f8dtawWTu9qobiViXMtFt5-uVrhMsL4ZO3CHGZ0dpZGq3Claz9hitbR_F0VQs3ofzo3KOPCKBy8kJL-f5_lZmRSmUH1zSRYOFg6dTOCGV9mipxFCl9mkKMjq41yH44o8MxQoxpy6N9aZu8aVv-i-dpXE9lVVzMKai062IriXk',
					'dp': 'Q8hfnVMhFH4TJHCfT_SlyTwtkKpiLPOUua4PcjfA-38Rj2JctAiBYWQer84jsdOR-_q8QxYgocPkUhlFneWujT7vabXEsB1aopJd46Hhm0MKTDsie5utJeJHvfekS1Pr5VF_muMAG00n_FQduWsIGZqCBXj0XspQzZdCAZVg0eE',
					'dq': 'ObIbn__8iPcyecbJZWq5ygzgmhgBkfzrOnXf_NAeZRDFqkVQhpXYa5KpgtbqhA9Wp7QYXyR9Sv8gNptF7IX-cgrSLIMw9FZUfum81refDoXd5M6SuYHOCOTEnBsc93x01lVOdPcCNwrYwxCzC92poItJHYGgWDbzUV-NbO94EcE',
					'qi': 'V7IIoHZWEfaGk_KQLJKk1LuEgbGzSAFbRO4C1gUCQSOWkNny_xjckmL92T6d8FsO1lVOAvxz_pUnQ-zuuvBxQYBGKNPoQqErIP0FFdEJoEPLIt32YWczh2rTQeabekk4EqtOlxB_08LM3I6vjU8-CCD6fGXHWDlVo9ZY4swOH4k',
					'kty': 'RSA',
					'kid': 'zzPwx9NTQ83FruZIezYq-ABhytV4KLdxEO42gWWJng4',
					'use': 'enc'
				},
				{
					'crv': 'P-256',
					'x': 'a5IL6dvlY1KuqHx8bPtjtw5YlOg7gQU9hSZuVqoHXyI',
					'y': 'YX40Rs-KUgdkm3qoORPoCse9JodMte5UC6ENB1wlBX4',
					'd': 'CBTPaBEzep5IECzukpo6Bj0mQs19u4dgzAD0xnwoFeo',
					'kty': 'EC',
					'kid': 'RH0IiDb1kMx9ZwvBeaQUD6vjidtVZ3vA8o6TGh6R9R4',
					'use': 'sig'
				},
				{
					'crv': 'P-256',
					'x': 'J2ykXZg3_4QwNz8OtZayfg_oPVIxVks53xuQ2y2iy9w',
					'y': 'LxAs73RaDd4va-qHvsLb-bNqx_cYmq7naUBDaGTYMV0',
					'd': 'Q20mRYj-1hDGHehgqoRyvG7gcAyO84bo1ZaDpVnZWDU',
					'kty': 'EC',
					'kid': 'nn3XMLZG_Q6uqA1gmIe6We5voM6oFC4JsbQ9JWOrvN8',
					'use': 'enc'
				},
				{
					'crv': 'Ed25519',
					'x': 'PLbPq_2mGytiz_F-hE6aiZ6vmKiBpQrck27Q-U142TA',
					'd': 'eVLKKiY7dx0TDY7ueDWom29PDw8SWernhoaSunlTFCM',
					'kty': 'OKP',
					'kid': 'HqSInbHH3p12jiuazOefI7B3JLjOtkHuGfS6P6ru46w',
					'use': 'sig'
				}
			],
			'requireVerified': true,
			'autoVerify': true,
			'passwordLessSupport': true,
			'centralPasswordReset': true,
			'scopes': [
				'example'
			]
		},
		'pluginOptions': {
			'notification': {
				'customService': {
					'enabled': false
				},
				'enabled': true,
				'ackRequiredOnOptional': false
			}
		},
		'createdAt': '2021-08-23T15:51:18.626Z',
		'modifiedAt': '2021-08-24T15:31:51.507Z',
		'modifiedBy': 'fe031227-e90b-444b-81cb-29bfc2b64810',
		'active': true,
		'locked': true,
		'name': 'root',
		'prettyName': 'root',
		'primaryDomain': 'https://unitedeffects.com',
		'primaryTOS': 'https://unitedeffects.com/tos',
		'primaryPrivacyPolicy': 'https://unitedeffects.com/privacy',
		'owner': 'fe031227-e90b-444b-81cb-29bfc2b64810',
		'__v': 0,
		'associatedClient': '42ce0392-4cda-46ff-9514-acb8b0bdf635'
	},
	newGroup(nm, pn, active = true, locked = false, preInit = false) {
		const out = JSON.parse(JSON.stringify(agMocks.group));
		const name = (nm) ? nm : uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals] });
		const pretty = (pn) ? pn : name.toLowerCase().split(' ').join('_');
		out._id = nanoid();
		out.name = name;
		out.prettyName = pretty;
		out.active = active;
		out.locked = locked;
		if (preInit === true) {
			out.active = false;
			out.owner = 'test@unitedeffects.com';
			out.pluginOptions.notification.enabled = false;
			out.config.passwordLessSupport = false;
			out.config.autoVerify = false;
			out.config.requireVerified = false;
			out.config.scopes = [];
			out.securityExpiration = new Date(Date.now() + (config.GROUP_SECURE_EXPIRES * 1000));
			delete out.associatedClient;
		}
		return out;
	}
};

export default agMocks;