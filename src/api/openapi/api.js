import swagger from '../../swagger';
const config = require('../../config');
const pJson = require('../../../package.json');

export default {
    async serveSwaggerUI(req, res, next) {
        return res.render('swagger', { title: pJson.name, group: req.params.group || undefined })
    },
    async serveApiJson(req, res, next) {
        try{
            const swag = JSON.parse(JSON.stringify(swagger));
            swag.info.version = pJson.version;
            swag.info.title = pJson.name;
            swag.info['x-logo'].url = pJson.logo;
            swag.info.description = (!req.params.group) ? swag.info.description : `<h3>AuthGroup and OIDC security set to: ${req.authGroup.name}</h3>${swag.info.description}`;
            if (config.SWAGGER) swag.servers = [{url: `${config.PROTOCOL}://${config.SWAGGER}`}];
            if(req.params.group) {
                swag.components.securitySchemes.openId.openIdConnectUrl = `${config.PROTOCOL}://${config.SWAGGER}/${req.authGroup.id}/.well-known/openid-configuration`
            }
            return res.json(swag);
        }catch (error) {
            console.info(error);
            res.json(swagger);
        }
    },
    async reDocApi(req, res, next) {
        return res.render('api', { title: pJson.name, group: req.params.group || undefined })
    }
}