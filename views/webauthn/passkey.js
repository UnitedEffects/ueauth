import {
	create,
	supported,
	parseCreationOptionsFromJSON,
} from 'https://cdn.jsdelivr.net/npm/@github/webauthn-json@2.1.1/dist/esm/webauthn-json.browser-ponyfill.js';

window.addEventListener( 'load', async function () {
	let count= 15;
	const getInfo = $('#getInfo');
	const instructions = $('#instruct');
	const altInstructions = $('#altInstructions');
	const auth = $('#auth');
	const emailInput = $('#email');
	const passwordInput = $('#password');
	const continueButton = $('#continue');
	const eFlash = $('#flash');
	const flashContainer = $('#flash-container');
	const passwordless = $('#passwordless');
	const magic = $('#magic');
	const device = $('#device');
	const loginButton = $('#login');
	const bindButton = $('#bind');
	const loading = $('#loading');
	const confirm = $('#confirm');
	const success = $('#success');
	const deviceAuth = $('#deviceAuth');
	const deviceFail = $('#device-try-again');

	let username;
	let password;

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

	continueButton.on('click', async (event) => {
		try {
			return findUser(state, event);
		} catch (error) {
			onError(error);
		}
	});

	loginButton.on('click', async (event) => {
		try {
			return getBasicToken(state, event);
		} catch (error) {
			onError(error);
		}
	});

	device.on('click', async (event) => {
		try {
			const result = await sendChallenge(state, event);
			console.info(result);
			hide(auth);
			unhide(deviceAuth);
			await checkDevice(state, result.response.guid, result.accountId, event);
		} catch (error) {
			onError(error);
		}
	});

	bindButton.on('click', async (event) => {
		try {
			// call user bind
			const binding = await bindWebAuthN(state, event);
			// call local create
			const options = await parseCreationOptionsFromJSON({ publicKey: binding.registrationOptions });
			const credentials = await create(options);
			// finish bind
			const done = await finishWebAuthN(state, event, credentials);
			console.info('done', done);
			if(done?.message === 'Registration successful!'){
				hide(instructions);
				hide(confirm);
				unhide(success);
				localStorage.setItem(`${window.location.host}:${authGroupId}:${user}`, JSON.stringify({ webauthn: true, accountId: user, authGroup: authGroupId, host: window.location.host, created: Date.now() }));
				console.info('localstorage', localStorage);
			}
		} catch (error) {
			onError(error);
		}
	});

	async function findUser(state, event) {
		hide(flashContainer);
		event.preventDefault();
		count = 15;
		if(!username) username = emailInput.val();
		const options = {
			method: 'get',
			url: `${domain}/api/${authGroupId}/account/login/options?lookup=${username}&state=${state}`
		};
		showSpinner();
		const result = await axios(options);
		console.info(result.data);
		hideSpinner();
		if(result?.data?.data?.state !== state) throw new Error(`unknown state: ${state}`);
		hide(getInfo);
		unhide(auth);
		if(result?.data?.data?.device || result?.data?.data?.magicLink) unhide(passwordless);
		if(result?.data?.data?.device) unhide(device);
		if(result?.data?.data?.magicLink) unhide(magic);
	}

	async function getBasicToken(state, event, device = {}) {
		hide(flashContainer);
		event.preventDefault();
		if(!username) username = emailInput.val();
		if(!password) password = passwordInput.val();
		const options = (device.providerKey && device.accountId) ? {
			method: 'post',
			url: `${domain}/${authGroupId}/token/simple-iat`,
			data: {
				state,
				providerKey: device.providerKey,
				accountId: device.accountId
			}
		} : {
			method: 'post',
			url: `${domain}/${authGroupId}/token/simple-iat`,
			auth: {
				username,
				password
			},
			data: {
				state
			}
		};
		showSpinner();
		const result = await axios(options);
		console.info(result.data);
		hideSpinner();
		if(result?.data?.data?.state !== state) throw new Error(`unknown state: ${state}`);
		return window.location.replace(`${domain}/${authGroupId}/passkey?token=${result.data.data.jti}&state=${state}`);
	}

	async function bindWebAuthN(state, event) {
		hide(flashContainer);
		event.preventDefault();
		const options = {
			method: 'post',
			url: `${domain}/api/${authGroupId}/webauthn/bind`,
			headers: {
				Authorization: `bearer ${token}`
			},
			data: {
				state
			}
		};
		showSpinner();
		const result = await axios(options);
		hideSpinner();
		if(!result?.data?.data?.registrationOptions) throw new Error('unsuccessful binding');
		return result.data.data;
	}

	async function finishWebAuthN(state, event, credential) {
		hide(flashContainer);
		event.preventDefault();
		const options = {
			method: 'post',
			url: `${domain}/api/${authGroupId}/webauthn/finish`,
			headers: {
				Authorization: `bearer ${token}`
			},
			data: {
				state,
				credential
			}
		};
		showSpinner();
		const result = await axios(options);
		hideSpinner();
		if(result?.data?.data?.message !== 'Registration successful!') throw new Error('unsuccessful binding');
		return result.data.data;
	}

	async function sendChallenge(state, event) {
		hide(flashContainer);
		event.preventDefault();
		if(!username) username = emailInput.val();
		const options = {
			method: 'post',
			url: `${domain}/api/${authGroupId}/device/challenge`,
			data: {
				state,
				lookup: username
			}
		};
		showSpinner();
		const result = await axios(options);
		hideSpinner();
		console.info(result.data);
		return result.data.data;
	}

	function delay(ms) {
		return new Promise(r => setTimeout(r, ms));
	}

	async function checkDevice(state, providerKey, accountId, event) {
		showSpinner();
		await delay(2000);
		const check = `api/${authGroupId}/mfa/${providerKey}/account/${accountId}/interaction/${state}/status`;
		try {
			const result = await axios.get(`${domain}/${check}`);
			console.info(result.status);
			if(result.status === 204) {
				console.info('yay', result.data);
				const token = await getBasicToken(state, event, { providerKey, accountId });
				console.info('token', result.data);
				hideSpinner();
				if(token?.data?.data?.state !== state) throw new Error(`unknown state: ${state}`);
				return window.location.replace(`${domain}/${authGroupId}/passkey?token=${token.data.data.jti}&state=${state}`);
			}
			return deviceFailedCheck(state, providerKey, accountId, event);
		} catch (e) {
			console.error(e);
			return deviceFailedCheck(state, providerKey, accountId, event);
		}
	}

	async function deviceFailedCheck(state, providerKey, accountId, event) {
		if(count === 0) {
			hideSpinner();
			unhide(deviceFail);
		} else {
			count = --count;
			return checkDevice(state, providerKey, accountId, event);
		}
	}

	//setup on load
	unhide(getInfo);
	hide(auth);
	if(supported()!== true) {
		hide(getInfo);
		hide(instructions);
		unhide(altInstructions);
		altInstructions.append('<p>This device does not supported passkey login. You may close this window</p>');
	}

});