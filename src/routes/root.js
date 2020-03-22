import express from 'express';
const router = express.Router();
const config = require('../config');
const swagger = require('../swagger').default;
const pJson = require('../../package.json');

router.get('/', (req, res) => {
    res.render('index', { title: config.NAME })
});

router.get('/api', (req, res) => {
    res.render('api', { title: config.NAME })
});

router.get('/swagger', (req, res) => {
    res.render('swagger', { title: config.NAME })
});

router.get('/swagger.json', (req, res) =>  {
    try{
        const swag = swagger;
        swag.info.version = pJson.version;
        if (config.SWAGGER) swag.servers = [{url: `${config.PROTOCOL}://${config.SWAGGER}/api`}];
        if (config.ENV.toLowerCase()==='production' || config.ENV.toLowerCase()==='qa') swag.schemes = ['https'];
        res.json(swag);
    }catch (error) {
        console.info(error);
        res.json(swagger);
    }
});

export default router;
