window.addEventListener( 'load', async function () {
	const startUrl = start;
	const recoverUrl = recover;
	let token;
	let p1 = true;
	let p2 = true;
	let p3 = true;
	const eCopyPassword = $('#copyPassword');
	const eCopyCodes = $('#copyCodes');

	eCopyPassword.on('click', async () => {
		try {
			const password = $('#showpass').val();
			eCopyPassword.css({ color: 'orange' });
			await navigator.clipboard.writeText(password);
		} catch(error) {
			console.error(error);
			$('#fl').css({ visibility: 'visible', position: 'inherit' });
			$('#flash').text('We seem to have run into a technical issue. Please try again later or contact your admin.');
		}
	});
	eCopyCodes.on('click', async () => {
		try {
			const codes = $('#newCodes').val();
			eCopyCodes.css({ color: 'orange' });
			await navigator.clipboard.writeText(codes);
		} catch(error) {
			console.error(error);
			$('#fl').css({ visibility: 'visible', position: 'inherit' });
			$('#flash').text('We seem to have run into a technical issue. Please try again later or contact your admin.');
		}
	});

	async function lockAccount(url, token, event) {
		try {
			event.preventDefault();
			const options = {
				url,
				method: 'put',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `bearer ${token}`
				},
				data: {
					email: $('#email').val()
				}
			};
			showSpinner();
			const result = await axios(options);
			hideSpinner();
			if(result?.status !== 204) throw result;
			$('#start').css({ visibility: 'hidden', position: 'absolute' });
			$('#result').css({ visibility: 'visible', position: 'inherit' });
		} catch (error) {
			hideSpinner();
			console.error(error);
			$('#fl').css({ visibility: 'visible', position: 'inherit' });
			$('#flash').text('We seem to have run into a technical issue. Please try again later or contact your admin.');
		}
	}

	async function startRecovery(url, event) {
		try {
			event.preventDefault();
			const data = {
				email: $('#email').val(),
				codes: [
					$('#code1').val(),
					$('#code2').val(),
					$('#code3').val(),
					$('#code4').val(),
					$('#code5').val(),
					$('#code6').val(),
					$('#code7').val(),
					$('#code8').val(),
					$('#code9').val(),
					$('#code10').val()
				]
			};

			const options = {
				url,
				method: 'post',
				headers: {
					'Content-Type': 'application/json'
				},
				data
			};
			showSpinner();
			const result = await axios(options);
			hideSpinner();
			if(result?.status !== 200 || !result?.data?.data?.token) throw result;
			token = result.data.data.token;
			$('#start').css({ visibility: 'hidden', position: 'absolute' });
			$('#recover').css({ visibility: 'visible', position: 'inherit' });
		} catch (error) {
			hideSpinner();
			console.error(error);
			$('#fl').css({ visibility: 'visible', position: 'inherit' });
			$('#flash').text('We seem to have run into a technical issue. Please try again later or contact your admin.');
		}
	}
	function showSpinner() {
		$('#loading').css({ visibility: 'visible', position: 'inherit' });
	}
	function hideSpinner() {
		$('#loading').css({ visibility: 'hidden', position: 'absolute' });
	}
    
	async function recoverSubmit(url, event) {
		try {
			event.preventDefault();
			if(!token) throw new Error('You have not successfully validated your codes or something has gone wrong. Please try again later and if the problem continues, contact the administrator');
			const password = $('#password').val();
			const p2 = $('#reenter-password').val();
			if(password !== p2) throw new Error('password mismatch');
			const data = {
				email: $('#email2').val()
			};
			if(password) data.password = password;
			const options = {
				url,
				method: 'put',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				data
			};
			showSpinner();
			const result = await axios(options);
			hideSpinner();
			if(result?.status !== 200 || !result?.data?.data?.id) throw result;
			const codes = result.data.data.codes;
			const newPassword = result.data.data.password;
			if(!navigator.clipboard) {
				eCopyPassword.css({ visibility: 'hidden', position: 'absolute' });
				eCopyCodes.css({ visibility: 'hidden', position: 'absolute' });
			}
			$('#recover').css({ visibility: 'hidden', position: 'absolute' });
			$('#result').css({ visibility: 'visible', position: 'inherit' });
			$('#showpass').val(newPassword);
			$('#newCodes').val(codes.join('     '));
		} catch (error) {
			hideSpinner();
			console.error(error);
			$('#fl').css({ visibility: 'visible', position: 'inherit' });
			$('#flash').text('We seem to have run into a technical issue. Please try again later or contact your admin.');
		}
	}

	$('#lockAccount').on('click', async (event) => {
		return lockAccount(panicUrl, lockToken, event);
	});

	$('#start-recovery').on('click', async (event) => {
		return startRecovery(startUrl, event);
	});

	$('#submit-recover').on('click', async (event) => {
		return recoverSubmit(recoverUrl, event);
	});

	$('#togglePassword1').on('click', () => {
		if(p1) {
			$('#password').get(0).setAttribute('type', 'text');
			p1 = false;
		} else {
			$('#password').get(0).setAttribute('type', 'password');
			p1 = true;
		}
		const toggle = $('#togglePassword1');
		toggle.toggleClass('fa-eye');
		toggle.toggleClass('fa-eye-slash');
	});

	$('#togglePassword2').on('click', () => {
		if(p2) {
			$('#reenter-password').get(0).setAttribute('type', 'text');
			p2 = false;
		} else {
			$('#reenter-password').get(0).setAttribute('type', 'password');
			p2 = true;
		}
		const toggle = $('#togglePassword2');
		toggle.toggleClass('fa-eye');
		toggle.toggleClass('fa-eye-slash');
	});

	$('#togglePassword3').on('click', () => {
		if(p3) {
			$('#showpass').get(0).setAttribute('type', 'text');
			p3 = false;
		} else {
			$('#showpass').get(0).setAttribute('type', 'password');
			p3 = true;
		}
		const toggle = $('#togglePassword3');
		toggle.toggleClass('fa-eye');
		toggle.toggleClass('fa-eye-slash');
	});
});