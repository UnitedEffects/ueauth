window.addEventListener( 'load', function () {
	function showSpinner() {
		$('#loading').css({ visibility: 'visible', position: 'inherit' });
	}
	function hideSpinner() {
		$('#loading').css({ visibility: 'hidden', position: 'absolute' });
	}
	hideSpinner();
	function sendData(FD) {
		const XHR = new XMLHttpRequest();
		XHR.addEventListener( 'load', function(event) {
			hideSpinner();
			if (event.target.status !== 204) {
				document.getElementById('message').classList.add('error');
				document.getElementById('title').innerHTML = 'Uh oh...';
				document.getElementById('message').innerHTML = 'Verification or reset was not successful. Your reset or verification window may have expired. Click below to resend the email';
				form.remove();
				document.getElementById('tryAgain').classList.remove('invisible');
			} else {
				document.getElementById('title').innerHTML = 'Reset Successful';
				document.getElementById('instruct').innerHTML = 'Your password was successfully reset.';
				document.getElementById('message').classList.add('success');
				if(redirect && redirect !== '') {
					form.remove();
					document.getElementById('gotoSite').classList.remove('invisible');
					document.getElementById('message').innerHTML = 'Your password is set. Click below to continue.';
				}
				else {
					document.getElementById('message').innerHTML = 'Your password is set. Go to your login screen to try it out.';
					form.remove();
				}
			}
		} );
		XHR.addEventListener( 'error', function( event ) {
			hideSpinner();
			document.getElementById('message').classList.add('error');
			document.getElementById('title').innerHTML = 'Uh oh...';
			document.getElementById('message').innerHTML = 'Verification or reset was not successful. Try again in a bit or contact the admin';
		} );
		XHR.open( 'POST', url);
		XHR.setRequestHeader('authorization', `bearer ${iat}`);
		XHR.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
		showSpinner();
		XHR.send( JSON.stringify({ 'password': `${FD.get('password')}` }) );
	}
	function resend(FD) {
		const XHR = new XMLHttpRequest();

		XHR.addEventListener( 'load', function(event) {
			hideSpinner();
			if (event.target.status !== 204) {
				console.info('error');
				document.getElementById('message').classList.add('error');
				document.getElementById('title').innerHTML = 'Uh oh...';
				document.getElementById('message').innerHTML = 'There may be a problem. Try again later or contact the admin.';
			} else {
				document.getElementById('title').innerHTML = 'Check Your Email or Mobile Device';
				const m1 = document.getElementById('message');
				if(m1) m1.classList.add('success');
				const i1 = document.getElementById('instruct');
				if(i1) i1.classList.add('success');
				const s1 = document.getElementById('send');
				if(s1) s1.classList.add('success');
				const t1 = document.getElementById('tryAgain');
				if(t1) t1.classList.add('success');
			}
		} );
		XHR.addEventListener( 'error', function( event ) {
			hideSpinner();
			document.getElementById('message').classList.add('error');
			document.getElementById('title').innerHTML = 'Uh oh...';
			document.getElementById('message').innerHTML = 'There may be a problem. Try again later or contact the admin.';
		} );
		XHR.open( 'POST', retryUrl);
		XHR.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
		showSpinner();
		XHR.send( JSON.stringify( {
			'email': FD.get('email')
		}) );

	}
	const form = document.getElementById( 'forgot' );
	if(form) {
		form.addEventListener( 'submit', function ( event ) {
			event.preventDefault();
			const data = new FormData(this);
			sendData(data);
		});
	}
	const retry = document.getElementById( 'tryAgain');
	if(retry) {
		retry.addEventListener( 'submit', function ( event ) {
			event.preventDefault();
			const data = new FormData(this);
			resend(data);
		});
	}
	const first = document.getElementById('send');
	if(first) {
		first.addEventListener( 'submit', function ( event ) {
			event.preventDefault();
			const data = new FormData(this);
			resend(data);
		});
	}
} );