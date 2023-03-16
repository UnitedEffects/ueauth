import spec from '../../swagger';
import modify from './swag';
const pJson = require('../../../package.json');

const { prod, doc: swagger } = spec;

export default {
	async serveSwaggerUI(req, res, next) {
		try {
			return res.render('swagger', {
				title: pJson.name,
				group: req.params.group || undefined,
				favicon: (req.authGroup) ? req.authGroup?.config?.ui?.skin?.favicon : undefined
			});
		} catch (e) {
			next(e);
		}
	},
	async serveApiJson(req, res) {
		try{
			let swag = JSON.parse(JSON.stringify(swagger));
			swag = modify.updateSwag(swag, req.authGroup, req.params, req.customDomain);
			return res.json(swag);
		}catch (error) {
			console.info(error);
			return res.json(swagger);
		}
	},
	async serveCleanApiJson(req, res) {
		try{
			let swag = JSON.parse(JSON.stringify(prod));
			swag = modify.updateSwag(swag, req.authGroup, req.params, req.customDomain);
			return res.json(swag);
		}catch (error) {
			console.info(error);
			return res.json(prod);
		}
	},
	async reDocApi(req, res, next) {
		try {
			return res.render('api', {
				title: pJson.name,
				group: req.params.group || undefined,
				favicon: (req.authGroup) ? req.authGroup?.config?.ui?.skin?.favicon : undefined
			});
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