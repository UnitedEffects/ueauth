import swagger from '../../swagger';
import modify from './swag';
const pJson = require('../../../package.json');

export default {
	async serveSwaggerUI(req, res, next) {
	    try {
			return res.render('swagger', { title: pJson.name, group: req.params.group || undefined });
		} catch (e) {
	        next(e);
		}
	},
	async serveApiJson(req, res) {
		try{
			let swag = JSON.parse(JSON.stringify(swagger));
			swag = modify.updateSwag(swag, req.authGroup, req.params);
			return res.json(swag);
		}catch (error) {
			console.info(error);
			return res.json(swagger);
		}
	},
	async reDocApi(req, res, next) {
	    try {
			return res.render('api', { title: pJson.name, group: req.params.group || undefined });
		} catch (e) {
	        next(e);
		}
	},
	async oauth2Redirect(req, res, next) {
	    try {
			return res.render('openapi-redirect');
		} catch (e) {
	        next(e);
		}
	}
};