import express from 'express';
const router = express.Router();
const config = require('../config');
const swagger = require('../swagger').default;
const pJson = require('../../package.json');

router.get('/', function(req, res, next) {
    res.render('index', {title: 'Boilerplate Service'})
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
