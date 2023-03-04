window.addEventListener( 'load', async function () {
	/*
	let token;
	let notifyUrl;
	let username;
	let password;
	let method;
	let providerKey;
	const params = new Proxy(new URLSearchParams(window.location.search), {
		get: (searchParams, prop) => searchParams.get(prop),
	});
	if(!state) {
		state = params.state;
	}
	function showSpinner() {
		$('#loading').css({ visibility: 'visible', position: 'inherit' });
	}
	function hideSpinner() {
		$('#loading').css({ visibility: 'hidden', position: 'absolute' });
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
			return basicRequest(data, event);
		} catch(error) {
			hideSpinner();
			console.error(error);
			$('#notify-device').prop('disabled', false);
			$('#notify-email').prop('disabled', false);
			// start over???
			$('#flash').append('<p>There was an error. Please try again later.</p>');
			$('#getInfo').css({ display: 'inherit' });
			$('#resetting').css({ display: 'none' });
			$('#notify').css({ display: 'none' });
			$('#notify-ready').css({display: 'none'});
		}
	}

	async function requestNotify(type, event) {
		try {
			method = type;
			$('#flash').append('');
			event.preventDefault();
			$('#notify-device').prop('disabled', true);
			$('#notify-email').prop('disabled', true);
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
			const jnReady = $('#notify-ready');
			if(result.status === 200) {
				$('#notify-buttons').css({ display: 'none' });
				$('#notify-message').css({ display: 'none' });
				switch(type) {
				case 'device':
					providerKey = result?.data?.data?.id;
					jnReady.css({ display: 'inherit' });
					jnReady.append('<div class="credentials"><p id="notify-ready-message">We have sent you a request on your device. After you approve, click the button below. PLEASE BE AWARE: THIS WILL REVOKE ALL MFA KEYS ON ALL DEVICES BEFORE ALLOWING YOU TO CONFIGURE YOUR CURRENT DEVICE.</p><button id="notify-done" class="btn btn-outline-dark btn-custom m-t-20">Ready to Proceed</button></div>');

					$('#notify-done').on('click', async (event) => {
						return requestDone(event, providerKey, undefined);
					});
					break;
				case 'email':
					jnReady.css({ display: 'inherit' });
					jnReady.append('<div class="credentials"><p id="notify-ready-message">We have sent you a code via email. Please check your inbox, copy/paste the code in the field below, and click the button below when ready. PLEASE BE AWARE: THIS WILL REVOKE ALL MFA KEYS ON ALL DEVICES BEFORE ALLOWING YOU TO CONFIGURE YOUR CURRENT DEVICE.</p><input id="code" name="code" type="text" aria-describedby="code" placeholder="code..."><label for="code">Code</label></input><button id="notify-done" class="btn btn-outline-dark btn-custom m-t-20">Ready to Proceed</button></div>');
					$('#notify-done').on('click', async (event) => {
						const code = $('#code').val();
						return requestDone(event, undefined, code);
					});
					break;
				default:
					throw new Error('unknown state');
				}
			} else throw result;
		} catch (error) {
			hideSpinner();
			console.error(error);
			$('#notify-device').prop('disabled', false);
			$('#notify-email').prop('disabled', false);
			$('#flash').append('<p>There was an error. Please try again later.</p>');
			$('#getInfo').css({ display: 'inherit' });
			$('#resetting').css({ display: 'none' });
			$('#notify').css({ display: 'none' });
			$('#notify-ready').css({display: 'none'});
		}
	}

	$('#recover-button').on('click', async (event) => {
		return basicRequest({ state }, event);
	});

	async function basicRequest(data, event) {
		try {
			const jNotify = $('#notify');
			const jResetting = $('#resetting');
			const jBasicInfo = $('#getInfo');
			if(!data.providerKey && !data.code) {
				jBasicInfo.css({ display: 'inherit' });
			}
			$('#flash').append('');
			jResetting.css({ display: 'none' });
			jNotify.css({ display: 'none' });
			$('#notify-ready').css({display: 'none'});
			event.preventDefault();
			if(!username) username = $('#email').val();
			if(!password) password = $('#password').val();
			this.disabled=true;
			const options = {
				method: 'post',
				url: url,
				auth: {
					username,
					password
				},
				data
			};
			showSpinner()
			const result = await axios(options);
			hideSpinner()
			if(result?.status === 200) {
				//instructions
				jBasicInfo.css({ display: 'none' });
				jResetting.css({ display: 'inherit' });
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
				jBasicInfo.css({ display: 'none' });
				jNotify.css({ display: 'inherit'});
				const notify = '<p id="notify-message"> It looks like you already have MFA enabled. This action would override your current settings so we need to make sure its you. You can verify your identity using your existing device or email. Please click the corresponding button.</p><div id="notify-buttons"><button class="btn btn-outline-dark btn-custom" id="notify-email">By Email...</button><button class="btn btn-outline-dark btn-custom m-t-20" id="notify-device">By Device...</button></div>';
				jNotify.append(notify);
				$('#notify-email').on('click', async (event) => {
					return requestNotify('email', event);
				});

				$('#notify-device').on('click', async (event) => {
					return requestNotify('device', event);
				});

			} else throw result;
		} catch (error) {
			// do something
			console.info('ERROR CAUGHT');
			console.info(error);
			hideSpinner();
			this.disabled=false;
			$('#getInfo').css({ display: 'inherit' });
			$('#resetting').css({ display: 'none' });
			$('#notify').css({ display: 'none' });
			$('#notify-ready').css({display: 'none'});
			$('#flash-container').css({ visibility: 'inherit', position: 'inherit' });
			if(error.status === 401) {
				$('#flash').append('<p>Your username and password were not valid...</p>');
			} else {
				$('#flash').append('<p>There was an error. Please try again later. If the problem continues, contact admin using the link below.</p>');
			}
		}
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

	 */
});