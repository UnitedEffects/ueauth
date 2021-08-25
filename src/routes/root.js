import express from 'express';
import openapi from '../api/openapi/api';
import m from '../middleware';

const router = express.Router();
const pJson = require('../../package.json');

router.get('/', (req, res) => {
    const date = new Date();
    return res.render('index', {
        title: pJson.name, version: pJson.version,
        description: pJson.description,
        by: pJson.author,
        url: pJson.person.url,
        year: date.getFullYear(),
        home: pJson.homepage
    });
});

router.get('/:group/api', m.validateAuthGroup, openapi.reDocApi);
router.get('/:group/swagger', m.validateAuthGroup, openapi.serveSwaggerUI);
router.get('/:group/swagger.json', m.validateAuthGroup, openapi.serveApiJson);

router.get('/api', openapi.reDocApi);
router.get('/swagger', openapi.serveSwaggerUI);
router.get('/swagger.json', openapi.serveApiJson);
router.get('/oauth2-redirect.html', openapi.oauth2Redirect);

export default router;
