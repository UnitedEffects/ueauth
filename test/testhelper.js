export default {
	fail (error = new Error('General Catch')) {
		console.info('ERROR CAUGHT - FAILING TEST');
		console.error(error);
		expect(true).toBe(false);
	}
};