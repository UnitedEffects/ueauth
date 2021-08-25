import swagger from '../../swagger';
const config = require('../../config');
const pJson = require('../../../package.json');

export default {
    async serveSwaggerUI(req, res, next) {
        return res.render('swagger', { title: pJson.name, group: req.params.group || undefined })
    },
    async serveApiJson(req, res, next) {
        try{
            let swag = JSON.parse(JSON.stringify(swagger));
            swag.info.version = pJson.version;
            swag.info.title = pJson.name;
            swag.info['x-logo'].url = pJson.logo;
            swag.info.description = (!req.params.group) ? swag.info.description : `<h3>AuthGroup and OIDC security set to: ${req.authGroup.name}</h3><p><i>Please note, you will still need to enter a value into the required group fields to make openapi requests; however, for your convenience, the ID of the authgroup you've selected, <strong>${req.authGroup.name} - ${req.authGroup.id}</strong>, is displayed and used rather than whatever you may enter in the field.</i></p>${swag.info.description}`;
            if (config.SWAGGER) swag.servers = [{url: `${config.PROTOCOL}://${config.SWAGGER}`}];
            if(req.params.group) {
                swag.components.securitySchemes.openId.openIdConnectUrl = `${config.PROTOCOL}://${config.SWAGGER}/${req.authGroup.id}/.well-known/openid-configuration`
                let temp = JSON.stringify(swag);
                temp = temp.replace(/{group}/g, req.params.group);
                swag = JSON.parse(temp);
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