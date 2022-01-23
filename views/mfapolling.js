window.addEventListener( 'load', async function () {
	const url = `/api/${authGroup}/interaction/${uid}/provider/${providerKey}/account/${accountId}/status`;
	const complete = `/${authGroup}/interaction/${uid}/confirm-mfa`;
	let count = 8;
	function formPost(url, fields) {
		const $form = $('<form>', {
			action: url,
			method: 'post'
		});
		$.each(fields, (key, val) => {
			$('<input>').attr({
				type: 'hidden',
				name: key,
				value: val
			}).appendTo($form);
		});
		$form.appendTo('#mfa').submit();
	}
	function delay(ms) {
		return new Promise(r => setTimeout(r, ms));
	}
	async function checkStatus(url) {
		try {
			await delay(2000);
			const result = await axios.get(url);
			if(result.status === 204) {
				return formPost(complete, {
					providerKey: providerKey,
					accountId: accountId
				});
			}
			count = --count;
			if(count > 0) await checkStatus(url);
		} catch (error) {
			count = --count;
			if(count > 0) await checkStatus(url);
		}
	}

	await checkStatus(url);
	if(count === 0) {
		console.info('display error message and offer to go back');
		$('#loading').css('display', 'none');
		$('#mfa-pending').text('Your Authorization Could Not Be Verified');
		$('#mfa-try-again').css('visibility', 'inherit');
	}
});