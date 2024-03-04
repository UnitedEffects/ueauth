import {
	supported,
	parseRequestOptionsFromJSON,
	get
} from 'https://cdn.jsdelivr.net/npm/@github/webauthn-json@2.1.1/dist/esm/webauthn-json.browser-ponyfill.js';

window.addEventListener( 'load', async function () {
	let count = 15;
	let token;
	let notifyUrl;
	let username;
	let password;
	let method;
	let providerKey;
	let credentials;
	let passkeyToken;
	let local;
	const continueButton = $('#recover-button');
	const eFlash = $('#flash');
	const flashContainer = $('#flash-container');
	const getInfo = $('#getInfo');
	const auth = $('#auth');
	const emailInput = $('#email');
	const passwordInput = $('#password');
	const magic = $('#magic');
	const passkey = $('#passkey');
	const passwordless = $('#passwordless');
	const loginBasic = $('#login');
	const loading = $('#loading');
	const notifyReady = $('#notify-ready');
	const notifyEmail = $('#notify-email')
	const notifyDevice = $('#notify-device');
	const notifyButtons = $('#notify-buttons');
	const notifyMessage = $('#notify-message');
	const notifyReadyMessage = $('#notify-read-message')
	const notifyDone = $('#notify-done');
	const jNotify = $('#notify');
	const jResetting = $('#resetting');
	const verified = $('#verified');
	const verifiedIdentity = $('#verifiedIdentity');
	const codeInput = $('#code');
	const codeLabel = $('#code-label');
	const passKeySupport = supported();
	const passKeyLink = $('#passkeyLink');

	if(iat) {
		unhide(verifiedIdentity)
		hide(getInfo);
	}

	function hide(element) {
		try {
			element.addClass('hidden');
		} catch(e) {
			console.error(e, 'moving on');
		}

	}

	function unhide(element) {
		try {
			element.removeClass('hidden');
		} catch(e) {
			console.error(e, 'moving on');
		}
	}

	function onError(error, msg) {
		hideSpinner();
		console.error(error);
		unhide(flashContainer);
		if(msg) eFlash.append(`<p>${msg}</p>`);
		else eFlash.append('<p>There was an error. Please try again later.</p>');
		unhide(getInfo);
		hide(auth);
		hide(verifiedIdentity);
		hide(jNotify);
		hide(notifyReady);
	}

	const params = new Proxy(new URLSearchParams(window.location.search), {
		get: (searchParams, prop) => searchParams.get(prop),
	});
	if(!state) {
		state = params.state;
	}
	function showSpinner() {
		loading.css({ visibility: 'visible', position: 'inherit' });
	}
	function hideSpinner() {
		loading.css({ visibility: 'hidden', position: 'absolute' });
	}

	continueButton.on('click', async (event) => {
		try {
			return findUser(state, event);
		} catch (error) {
			onError(error);
		}
	});

	loginBasic.on('click', async (event) => {
		try {
			return basicRequest({ state }, event);
		} catch (error) {
			onError(error)
		}
	})

	verified.on('click', async (event) => {
		try {
			return basicRequest({ state }, event, { token: iat, accountId });
		} catch (error) {
			onError(error)
		}
	})

	passkey.on('click', async (event) => {
		try {
			hide(auth);
			credentials = await webAuthNAuthenticate(event, username);
			const local = localStorage.getItem(`${window.location.host}:${authGroupId}:${credentials.accountId}`);
			if(!local) {
				unhide(flashContainer);
				eFlash.append('<span id="passkey-message">You may need to set up passkey to use this feature. Click Set Passkey and try again if this does not work.</span>')
			}
			if(credentials) {
				const result = await parseRequestOptionsFromJSON({ publicKey: credentials.assertionOptions });
				const data = await get(result);
				if(data) return basicRequest({ state, passkey: { accountId: credentials.accountId, credential: data } }, event);
			}
			throw 'Passkey was not supported. You need to click "Set Passkey" to set that up or try a different verification method.';
		} catch (error) {
			onError(error);
		}
	});

	magic.on('click', async (event) => {
		try {
			return sendEmail(state, event);
		} catch (error) {
			onError(error);
		}
	});

	notifyEmail.on('click', async (event) => {
		return requestNotify('email', event);
	});

	notifyDevice.on('click', async (event) => {
		return requestNotify('device', event);
	});

	notifyDone.on('click', async (event) => {
		if(providerKey) {
			return requestDone(event, providerKey, undefined);
		} else {
			const code = $('#code').val();
			return requestDone(event, undefined, code);
		}
	});

	async function findUser(state, event) {
		try {
			hide(flashContainer);
			event.preventDefault();
			count = 15;
			if(!username) username = emailInput.val();
			if(!username) throw 'Email required';
			const options = {
				method: 'get',
				url: `${domain}/api/${authGroupId}/account/login/options?lookup=${encodeURIComponent(username)}&state=${state}`
			};
			showSpinner();
			const result = await axios(options);
			hideSpinner();
			if(result?.data?.data?.state !== state) throw new Error(`unknown state: ${state}`);
			hide(getInfo);
			unhide(auth);
			if(result?.data?.data?.magicLink || (result?.data?.data?.passkey && passKeySupport === true)) unhide(passwordless);
			if(result?.data?.data?.magicLink) unhide(magic);
			if(result?.data?.data?.passkey && passKeySupport === true) unhide(passkey);
		} catch (e) {
			onError(true, e);
		}
	}

	async function basicRequest(data, event, authData = {}) {
		try {
			showSpinner()
			hide(flashContainer);
			hide(auth);
			hide(jResetting);
			hide(jNotify);
			hide(notifyReady);
			hide(verifiedIdentity);
			event.preventDefault();
			if(!username) username = emailInput.val();
			if(!password) password = passwordInput.val();
			const options = (data.passkey?.data) ? {
				method: 'post',
				url: url,
				data
			} : (authData.token) ? {
				method: 'post',
				url: url,
				headers: {
					Authorization: `bearer ${authData.token}`,
				},
				data
			} : {
				method: 'post',
				url: url,
				auth: {
					username,
					password
				},
				data
			};
			console.info(options);
			const result = await axios(options);
			hideSpinner()
			if(result?.status === 200) {
				hide(verifiedIdentity);
				hide(getInfo);
				hide(auth);
				unhide(jResetting);
				if(result.data?.data?.passkeyToken) passkeyToken = result.data.data.passkeyToken;
				let instruct = '<p id="reset-instructions">You are ready to roll. Follow the instructions below. When you finish, click the button to close this window and go back to your login screen.</p><ol class="m-t-20 list-group list-group-flush list-group-numbered">';
				result.data?.data?.instructions.map((i) => {
					instruct = `${instruct}<li class="list-group-item">${i}</li>`;
				});
				if(result.data?.data?.qrCode) {
					instruct = `${instruct}</ol><div class="canvas m-t-20"><canvas class="canvas-50" id="qrcode"></canvas></div>`;
				} else instruct = `${instruct}</ol>`;

				if(result.data?.data?.proxyEnableScreen){
					instruct = `${instruct}<div class="m-t-20 m-b-20 center"><a href="${result.data?.data?.proxyEnableScreen}" type="button" class="btn btn-outline-dark btn-custom">${(result.data?.data?.proxyEnableScreenButtonText) ? result.data?.data?.proxyEnableScreenButtonText : 'Click Here for Setup'}</a></div>`;
				}

				if(result.data?.data?.warnings && result.data?.data?.warnings.length !== 0) {
					console.error(result.data.data.warnings);
					instruct = `${instruct}<h4 class="center m-t-20" style="color: coral">WARNING: This action was unable to revoke your previous devices. We are allowing you to setup your current device so as not to block you but we encourage you to change your password, attempt a recovery again soon, and if you see this message then, please contact your admin.</h4>`
				}

				instruct = `${instruct}<div class="center m-t-20"><h3>If you have finished, you may close this window.</h3></div>`;

				jResetting.append(instruct);
				await createQR(result.data.data.qrCode);
			} else if(result.status === 202) {
				//selection
				token = result?.data?.data?.token;
				notifyUrl = result?.data?.data?.uri;
				if(result.data?.data?.passkeyToken) passkeyToken = result.data.data.passkeyToken;
				hide(getInfo);
				hide(auth);
				hide(verifiedIdentity);
				unhide(jNotify)
				notifyMessage.append('<span id="existing-message">It looks like you already have device enabled. This action would override your current settings so we need to make sure its you. Click one of the methods to double check.</span>')
			} else throw result;
		} catch (error) {
			console.error('ERROR CAUGHT', error.response);
			hideSpinner();
			reset();
			unhide(flashContainer);
			if(error.response?.status === 401) {
				onError(true, 'Unable to complete the operation. Your identity confirmation may have expired or your username/password was incorrect.')
			} else {
				onError(true, 'There was an error. Please try again later. If the problem continues, contact admin using the link below.')
			}
		}
	}

	async function requestDone(event, pk = undefined, code=undefined) {
		try {
			// if email entered... method = email
			const data = {
				state: state,
				method
			};
			if(code) data.code = code;
			if(pk) data.providerKey = pk;
			const authData = {}
			if(passkeyToken) authData.token = passkeyToken;
			else if(iat) authData.token = iat;
			return basicRequest(data, event, authData);
		} catch(error) {
			hideSpinner();
			console.error(error);
			notifyDevice.prop('disabled', false);
			notifyEmail.prop('disabled', false);
			// start over...
			onError(true,'There was an error. Please try again later.');
			reset();
		}
	}

	async function requestNotify(type, event) {
		try {
			method = type;
			eFlash.append('');
			event.preventDefault();
			notifyDevice.prop('disabled', true);
			notifyEmail.prop('disabled', true);
			const options = {
				method: 'post',
				url: notifyUrl,
				headers: {
					Authorization: `bearer ${token}`
				},
				data: {
					state: state,
					selection: type
				}
			};
			showSpinner()
			const result = await axios(options);
			hideSpinner()
			if(result.status === 200) {
				hide(notifyButtons);
				hide(notifyMessage);
				switch(type) {
				case 'device':
					providerKey = result?.data?.data?.id;
					unhide(notifyReady);
					notifyReadyMessage.append('<span id="notify-message-device">We have sent you a request on your device. After you approve, click the button below. PLEASE BE AWARE: THIS WILL REVOKE ALL DEVICE KEYS ON ALL DEVICES BEFORE ALLOWING YOU TO CONFIGURE YOUR CURRENT DEVICE.</span>')
					break;
				case 'email':
					unhide(notifyReady);
					unhide(codeInput);
					unhide(codeLabel);
					notifyReadyMessage.append('<span id="notify-message-device">We have sent you a code via email. Please check your inbox, copy/paste the code in the field below, and click the button below when ready. PLEASE BE AWARE: THIS WILL REVOKE ALL MFA KEYS ON ALL DEVICES BEFORE ALLOWING YOU TO CONFIGURE YOUR CURRENT DEVICE.</span>')
					break;
				default:
					throw new Error('unknown state');
				}
			} else throw result;
		} catch (error) {
			hideSpinner();
			console.error(error);
			notifyDevice.prop('disabled', false);
			notifyEmail.prop('disabled', false);
			onError('There was an error. Please try again later');
			reset();
		}
	}

	function reset() {
		unhide(getInfo);
		hide(jResetting);
		hide(jNotify);
		hide(notifyReady);
	}

	async function createQR (qrCode) {
		if(qrCode) {
			var qr = new QRious({
				element: document.getElementById('qrcode'),
				size: 500,
				value: qrCode
			});
		}
	}

	async function sendEmail(state, event) {
		event.preventDefault();
		if(!username) username = emailInput.val();
		return window.location.replace(`${domain}/${authGroupId}/recover-mfa/email-verify?state=${state}&lookup=${username}`);
	}

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

	if(passKeySupport === true) {
		unhide(passKeyLink);
	}
});