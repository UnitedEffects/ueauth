const config = require('../../config');
const pJson = require('../../../package.json');

export default {
	updateSwag(swag, authGroup, params) {
		swag.info.version = pJson.version;
		swag.info.title = pJson.name;
		swag.info['x-logo'].url = pJson.logo;
		swag.info.description = (config.ENV !== 'production') ? `${swag.info.description}<h4 style='color:red'>WARNING: THIS IS A DEMO AND TEST ENVIRONMENT. ALL DATA IS EPHEMERAL AND SUBJECT TO DELETION.</h4>` : swag.info.description;
		swag.info.description = (!params.group) ? swag.info.description : `<h3>AuthGroup and OIDC security set to: ${authGroup.name}</h3><p><i>Please note, you will still need to enter a value into the required group fields to make openapi requests; however, for your convenience, the ID of the authgroup you've selected, <strong>${authGroup.name} - ${authGroup.id}</strong>, is displayed and used rather than whatever you may enter in the field.</i></p>${swag.info.description}`;
		if (config.SWAGGER) swag.servers = [{url: `${config.PROTOCOL}://${config.SWAGGER}`}];
		if(params.group) {
			swag.components.securitySchemes.openId.openIdConnectUrl = `${config.PROTOCOL}://${config.SWAGGER}/${authGroup.id}/.well-known/openid-configuration`;
			let temp = JSON.stringify(swag);
			temp = temp.replace(/{group}/g, params.group);
			swag = JSON.parse(temp);
		}
		return swag;
	}
};