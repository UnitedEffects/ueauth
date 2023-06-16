import express from 'express';
import openapi from '../api/openapi/api';
import m from '../middleware';

const router = express.Router();
const pJson = require('../../package.json');
const config = require('../config');

router.get('/', m.validateHostDomain, (req, res) => {
	const date = new Date();
	if(req.customDomain) {
		return res.render('index', {
			version: pJson.version,
			by: `${req.authGroup.name} Platform`,
			url: req.authGroup.primaryDomain,
			company: req.authGroup.name,
			year: date.getFullYear(),
			home: pJson.homepage,
			custom: true,
			production: (config.ENV === 'production')
		});
	}
	return res.render('index', {
		title: pJson.name, version: pJson.version,
		description: pJson.description,
		by: pJson.author,
		url: config.INIT_ROOT_PRIMARY_DOMAIN,
		company: config.ROOT_COMPANY_NAME,
		year: date.getFullYear(),
		home: pJson.homepage,
		custom: false,
		production: (config.ENV === 'production')
	});
});
router.get('/favicon.ico', m.nofavicon);
router.get('/ready-check', m.health);
router.get('/:group/api', m.validateAuthGroup, openapi.reDocApi);
router.get('/:group/swagger', m.validateAuthGroup, openapi.serveSwaggerUI);
router.get('/:group/swagger.json', m.validateAuthGroup, openapi.serveApiJson);
router.get('/:group/cleanapi.json', m.validateAuthGroup, openapi.serveCleanApiJson);

router.get('/api', m.validateHostDomain, openapi.reDocApi);
router.get('/swagger', m.validateHostDomain, openapi.serveSwaggerUI);
router.get('/swagger.json', m.validateHostDomain, openapi.serveApiJson);
router.get('/cleanapi.json', m.validateHostDomain, openapi.serveCleanApiJson);
router.get('/oauth2-redirect.html', m.validateHostDomain, openapi.oauth2Redirect);

export default router;
