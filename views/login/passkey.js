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
	let passKey = supported();
	let local;
	let credentials;
	if(typeof agWebAuthN === 'string') agWebAuthN = (agWebAuthN === 'true');
	let passwordFreeError = false;

	function hide(element) {
		element.addClass('hidden');
	}

	function unhide(element) {
		element.removeClass('hidden');
	}

	function onError(error) {
		hideSpinner();
		console.error(error);
		unhide(flashContainer);
		eFlash.append('<p>There was an error. Please try again later.</p>');
	}

	function showSpinner() {
		unhide(loading);
		loading.css({ visibility: 'visible', position: 'inherit' });
	}

	function hideSpinner() {
		hide(loading);
		loading.css({ visibility: 'hidden', position: 'absolute' });
	}

	magicButton.on('click', async (event) => {
		try {
			const email = emailInput.val();
			if(email && !credentials && passKey === true && agWebAuthN === true && passwordFreeError === false) {
				//if all of this is true, we will give passkey a try
				credentials = await webAuthNAuthenticate(event, email);
				local = localStorage.getItem(`${window.location.host}:${authGroupId}:${credentials.accountId}`);
				localPasskey.val(local);
				console.info(local);
				local = JSON.parse(local);
				if(local.webauthn === true &&
					local.accountId === credentials.accountId &&
					local.authGroup === authGroupId) {
					const result = await parseRequestOptionsFromJSON({ publicKey: credentials.assertionOptions });
					const data = await get(result);
					pkCreds.val(JSON.stringify(data));
					pkAcc.val(credentials.accountId);
					magicButton.val('magic-passkey');
					magicButton.trigger(event.type);
				}
				// fallback to the modal
				magicButton.trigger(event.type);
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
		console.info(options);
		showSpinner();
		const result = await axios(options);
		hideSpinner();
		//todo generalize response expectations on binding as well
		if(result?.data?.data?.success !== true) throw new Error('unsuccessful auth request');
		return result.data.data;
	}

	if(supported()) {
		unhide(passKeyLink);
	} else hide(passKeyLink);
});