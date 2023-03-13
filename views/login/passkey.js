import {
	supported,
	parseRequestOptionsFromJSON,
	get
} from 'https://cdn.jsdelivr.net/npm/@github/webauthn-json@2.1.1/dist/esm/webauthn-json.browser-ponyfill.js';

window.addEventListener( 'load', async function () {
	const flashContainer = $('#flash-container');
	const eFlash = $('#flash');
	const loading = $('#loading'); //todo add to login screen
	const emailInput = $('#email');
	const magicButton = $('#magic-email');
	const pkCreds = $('#pkCreds');
	const pkAcc = $('#pkAcc');
	const passKeyLink = $('#passkeyLink');
	const localPasskey = $('#localPasskey');
	const magicPasskey = $('#magic-passkey');
	const pwfAccountId = $('#accountId');
	const pwfAccountEmail = $('#accountEmail');
	let passKey = supported();
	let local;
	let credentials;
	if(typeof agWebAuthN === 'string') agWebAuthN = (agWebAuthN === 'true');
	if(typeof agDevice === 'string') agDevice = (agDevice === 'true');
	if(typeof agMagicLink === 'string') agMagicLink = (agMagicLink === 'true');
	let passwordFreeError = false;

	function hide(element) {
		element.addClass('hidden');
	}

	function unhide(element) {
		element.removeClass('hidden');
	}

	function showSpinner() {
		unhide(loading);
		loading.css({ visibility: 'visible', position: 'inherit' });
	}

	function hideSpinner() {
		hide(loading);
		loading.css({ visibility: 'hidden', position: 'absolute' });
	}

	magicPasskey.on('click', async (event) => {
		try {
			const email = pwfAccountEmail.val();
			const accId = pwfAccountId.val();
			if(email && !credentials && passwordFreeError === false) {
				credentials = await webAuthNAuthenticate(event, email);
				if(credentials.accountId !== accId) throw new Error('Unexpected account ID');
				const result = await parseRequestOptionsFromJSON({ publicKey: credentials.assertionOptions });
				const data = await get(result);
				pkCreds.val(JSON.stringify(data));
				magicPasskey.trigger(event.type);
			}
		} catch (e) {
			pkCreds.val(null);
			credentials = null;
			passwordFreeError = true;
			magicPasskey.trigger(event.type);
		}
	});

	async function finalizeWebAuthN(credentials, event) {
		try {
			const result = await parseRequestOptionsFromJSON({ publicKey: credentials.assertionOptions });
			const data = await get(result);
			pkCreds.val(JSON.stringify(data));
			pkAcc.val(credentials.accountId);
			magicButton.val('magic-passkey');
		} catch (error) {
			passwordFreeError = true;
		}
		magicButton.trigger(event.type);
	}

	magicButton.on('click', async (event) => {
		try {
			const email = emailInput.val();
			if(email && !credentials && passKey === true && agWebAuthN === true && passwordFreeError === false) {
				//if all of this is true, we will give passkey a try
				credentials = await webAuthNAuthenticate(event, email);
				try {
					local = localStorage.getItem(`${window.location.host}:${authGroupId}:${credentials.accountId}`);
					local = JSON.parse(local);
					localPasskey.val(JSON.stringify(local));
				} catch (e) {
					//do nothing...
				}
				if(agDevice !== true && agMagicLink !== true) {
					return finalizeWebAuthN(credentials, event);
				} else {
					local = localStorage.getItem(`${window.location.host}:${authGroupId}:${credentials.accountId}`);
					localPasskey.val(local);
					local = JSON.parse(local);
					if(local.webauthn === true &&
						local.accountId === credentials.accountId &&
						local.authGroup === authGroupId) {
						return finalizeWebAuthN(credentials, event);
					}
					// fallback to the modal
					magicButton.trigger(event.type);
				}
			}
		} catch (error) {
			pkCreds.val(null);
			pkAcc.val(null);
			credentials = null;
			passwordFreeError = true;
			magicButton.trigger(event.type);
		}
	});


	async function webAuthNAuthenticate(event, email) {
		event.preventDefault()
		hide(flashContainer);
		const options = {
			method: 'post',
			url: `${domain}/api/${authGroupId}/webauthn/authenticate`,
			data: {
				email
			}
		};

		showSpinner();
		const result = await axios(options);
		hideSpinner();
		if(result?.data?.data?.success !== true) throw new Error('unsuccessful auth request');
		return result.data.data;
	}

	if(supported()) {
		unhide(passKeyLink);
	} else {
		hide(passKeyLink);
		hide(magicPasskey);
	}
});