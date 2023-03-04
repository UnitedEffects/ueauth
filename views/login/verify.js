window.addEventListener( 'load', async function () {
	const emailInput = $('#email');
	$('#veriMail').on('click', async (event) => {
		event.preventDefault();
		const email = emailInput.val();
		if(email) {
			const options = {
				method: 'post',
				url: `${url}/operations/resend-verify-email`,
				data: {
					email
				}
			};
			try {
				const result = await axios(options);
				if(result?.status !== 204) throw new Error();
				$('#flash').text('Success! Close this window, check your email, and try to login again after verifying your account.');

			} catch (error) {
				$('#flash').text('There was a problem. Please try again later');
			}
		}
	});
});