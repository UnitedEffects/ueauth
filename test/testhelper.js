export default {
	fail (error = new Error('General Catch')) {
		console.info('ERROR CAUGHT - FAILING TEST');
		if(!error) error = new Error('General Catch');
		console.error(error);
		expect(error).not.toBeDefined();
	}
};