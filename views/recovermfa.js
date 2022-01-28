window.addEventListener( 'load', async function () {
	let token;
	let notifyUrl;
	let username;
	let password;
	let method;
	let providerKey;

	function close_window() {
		close();
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
			console.error(error);
			$('#notify-device').prop('disabled', false);
			$('#notify-email').prop('disabled', false);
			// start over???
			$('#flash').append('<h5 class="error">There was an error. Please try again later.</h5>');
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
			console.info('INSIDE REQ SELECT');
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

			console.info(options);
			const result = await axios(options);
			if(result.status === 200) {
				console.info(result);
				$('#notify-buttons').css({ display: 'none' });
				$('#notify-message').css({ display: 'none' });
				switch(type) {
				case 'device':
					providerKey = result?.data?.data?.id;
					const jnReady = $('#notify-ready');
					jnReady.css({ display: 'inherit' });
					jnReady.append('<p id="notify-ready-message">We have sent you a request on your device. After you approve, click the button below</p><button id="notify-done" class="btn btn-outline-dark m-3">Ready to Proceed</button>');

					$('#notify-done').on('click', async (event) => {
						console.info('DONE CLICKED');
						return requestDone(event, providerKey, undefined);
					});
					break;
				case 'email':
					break;
				default:
					throw new Error('unknown state');
				}
			} else throw result;
		} catch (error) {
			console.error(error);
			$('#notify-device').prop('disabled', false);
			$('#notify-email').prop('disabled', false);
			// start over???
			$('#flash').append('<h5 class="error">There was an error. Please try again later.</h5>');
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
			console.info(options);
			const result = await axios(options);
			console.info(result);
			if(result.status === 200) {
				//instructions
				jBasicInfo.css({ display: 'none' });
				jResetting.css({ display: 'inherit' });
				console.info('INSTRUCTIONS!');
				console.info(result);
				let instruct = '<p id="reset-instructions"><strong>You are ready to roll.</strong> Follow the instructions below. When you finish, click the button to close this window and go back to your login screen.</p><ol class="m-t-20 list-group list-group-flush list-group-numbered">';
				result.data.data.instructions.map((i) => {
					instruct = `${instruct}<li class="list-group-item">${i}</li>`;
				});
				instruct = `${instruct}</ol><div class="canvas"><canvas class="canvas-width" id="qrcode"></canvas></div><h5>If you have finished, you may close this window.</h5>`;
				jResetting.append(instruct);
				await createQR(result.data.data.qrCode);
			} else if(result.status === 202) {
				//selection
				token = result?.data?.data?.token;
				notifyUrl = result?.data?.data?.uri;
				console.info(token);
				console.info(notifyUrl);
				jBasicInfo.css({ display: 'none' });
				jNotify.css({ display: 'inherit'});
				const notify = '<p id="notify-message"> It looks like you already have MFA enabled. This action would override your current settings so we need to make sure its you. You can verify your identity using your existing device or email. Please click the corresponding button.</p><div id="notify-buttons"><button class="btn btn-block btn-outline-dark m-3" id="notify-email">By Email...</button><button class="btn btn-block btn-outline-dark m-3" id="notify-device">By Device...</button></div>';
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
			console.info('Basic Auth Error');
			console.info(error);
			this.disabled=false;
			$('#getInfo').css({ display: 'inherit' });
			$('#resetting').css({ display: 'none' });
			$('#notify').css({ display: 'none' });
			$('#notify-ready').css({display: 'none'});
			if(error.status === 401) {
				$('#flash').append('<h5 class="error">Your username and password were not valid...</h5>');
			} else {
				$('#flash').append('<h5 class="error">There was an error. Please try again later.</h5>');
			}
		}
	}

	async function createQR (qrCode) {
		console.info('Inside QR');
		console.info(qrCode);
		if(qrCode) {
			var qr = new QRious({
				element: document.getElementById('qrcode'),
				size: 500,
				value: qrCode
			});
		}
	}
});