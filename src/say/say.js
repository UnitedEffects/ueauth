export default {
	ok(data='OK', type='object') {
		return {
			statusCode: 200,
			type,
			data
		};
	},
	created(data='Created', type='object') {
		return {
			statusCode: 201,
			type,
			data
		};
	},
	noContent(type='object') {
		return {
			statusCode: 204,
			type
		};
	},
	accepted(data='Accepted', type='object') {
		return {
			statusCode: 202,
			type,
			data
		};
	},
	partial(data='Partial Content', type='object') {
		return {
			statusCode: 206,
			type,
			data
		};
	},
	specifically(statusCode, data, type, error, message) {
		return {
			statusCode,
			type,
			data,
			error,
			message
		};
	}
};