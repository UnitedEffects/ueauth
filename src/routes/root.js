import express from 'express';
import swagger from '../swagger';
import m from '../middleware';
import interactions from "../api/oidc/interactions/interactions_api";

const router = express.Router();
const config = require('../config');
const pJson = require('../../package.json');

router.get('/', (req, res) => {
    res.render('index', { title: pJson.name, description: pJson.description, by: pJson.author, url: pJson.url  })
});

router.get('/api', (req, res) => {
    res.render('api', { title: pJson.name })
});

router.get('/swagger', (req, res) => {
    res.render('swagger', { title: pJson.name })
});

router.get('/swagger.json', (req, res) =>  {
    try{
        const swag = swagger;
        swag.info.version = pJson.version;
        swag.info.title = pJson.name;
        swag.info.description = `${pJson.description} by: <a href="${pJson.url}">${pJson.author}</a>`;
        swag.info['x-logo'].url = pJson.logo;
        if (config.SWAGGER) swag.servers = [{url: `${config.PROTOCOL}://${config.SWAGGER}/api`}];
        if (config.ENV.toLowerCase()==='production' || config.ENV.toLowerCase()==='qa') swag.schemes = ['https'];
        res.json(swag);
    }catch (error) {
        console.info(error);
        res.json(swagger);
    }
});

// Interactions
function setNoCache(req, res, next) {
    res.set('Pragma', 'no-cache');
    res.set('Cache-Control', 'no-cache, no-store');
    next();
}

//todo - might need to render error pages here instead of just throwing the error...
router.get('/:group/interaction/:uid', [setNoCache, m.validateAuthGroup], interactions.getInt);
router.post('/:group/interaction/:uid/login', [setNoCache, m.validateAuthGroup], interactions.login);
router.post('/:group/interaction/:uid/confirm', [setNoCache, m.validateAuthGroup], interactions.confirm);
router.get('/:group/interaction/:uid/abort', [setNoCache, m.validateAuthGroup], interactions.abort);

export default router;
