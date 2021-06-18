import express from 'express';
import swagger from '../swagger';

const router = express.Router();
const config = require('../config');
const pJson = require('../../package.json');

router.get('/', (req, res) => {
    const date = new Date();
    return res.render('index', { title: pJson.name, version: pJson.version, description: pJson.description, by: pJson.author, url: pJson.person.url, year: date.getFullYear(), home: pJson.homepage  });
});

router.get('/api', (req, res) => {
    return res.render('api', { title: pJson.name })
});

router.get('/swagger', (req, res) => {
    return res.render('swagger', { title: pJson.name })
});

router.get('/swagger.json', (req, res) =>  {
    try{
        const swag = swagger;
        swag.info.version = pJson.version;
        swag.info.title = pJson.name;
        swag.info['x-logo'].url = pJson.logo;
        if (config.SWAGGER) swag.servers = [{url: `${config.PROTOCOL}://${config.SWAGGER}`}];
        return res.json(swag);
    }catch (error) {
        console.info(error);
        res.json(swagger);
    }
});

export default router;
