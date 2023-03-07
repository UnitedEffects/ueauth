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
	const passkeyButton = $('#passkey');
	const pkCreds = $('#pkCreds');
	const pkAcc = $('#pkAcc');

	let credentials;

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

	passkeyButton.on('click', async (event) => {
		try {
			const email = emailInput.val();
			if(email && !credentials) {
				credentials = await webAuthNAuthenticate(event);
				const result = await parseRequestOptionsFromJSON({ publicKey: credentials.assertionOptions });
				const data = await get(result);
				pkCreds.val(JSON.stringify(data));
				pkAcc.val(credentials.accountId);
				passkeyButton.trigger(event.type);
			}
		} catch (error) {
			console.error(error);
			pkCreds.val(null);
			pkAcc.val(null);
			credentials = null;
			onError(error);
		}
	});


	async function webAuthNAuthenticate(event) {
		hide(flashContainer);
		event.preventDefault();
		//todo add something to ensure email is required....
		const email = emailInput.val();
		if(email) {
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
	}

	if(supported()!== true) {
		console.error('no passkey');
	}
});