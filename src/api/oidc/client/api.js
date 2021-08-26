import Boom from '@hapi/boom';
import { say } from '../../../say';
import client from './clients';
import rat from '../regAccess/rat';
import permissions from "../../../permissions";

const RESOURCE = 'Clients';

const api = {
    async get(req, res, next) {
        try {
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide Auth Group'));
            const result = await client.get(req.authGroup, req.query);
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },

    async getOne(req, res, next) {
        try {
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide Auth Group'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            await permissions.enforceOwn(req.permissions, req.params.id);
            const result = await client.getOne(req.authGroup, req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },

    async patchOne(req, res, next) {
        try {
            // We may deprecate this in favor of the more secure update process built into OIDC
            // Any audit log of modification (who and when) will need to be managed outside of the record
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide Auth Group'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            await permissions.enforceOwn(req.permissions, req.params.id);
            const pre = await client.getOneFull(req.authGroup, req.params.id);
            if(!pre) throw Boom.notFound(req.params.id);
            if(pre._id === req.authGroup.associatedClient) return next(Boom.badRequest('You can not edit your Auth Group primary client'));
            let patched = JSON.parse(JSON.stringify(pre));
            const tempSecret = patched.payload.client_secret;
            try {
                patched.payload = await client.preparePatch(pre.payload, req.body);
            } catch (error) {
                throw Boom.badRequest(error.message);
            }
            patched.payload.client_secret = tempSecret;
            // this depends on the swagger.yaml file to define the correct object and requirements
            const schemaErrors = await client.checkSchema(patched);
            if(schemaErrors.length !== 0) {
                throw Boom.badRequest(schemaErrors);
            }
            if(await client.checkAllowed(pre, patched) === false) {
                throw Boom.forbidden(`Patch not supported for requested properties on this api. Use PUT /${req.authGroup.prettyName}/reg/${req.params.id}`);
            }
            const checkOIDCErrors = await client.validateOIDC(patched.payload);
            switch (checkOIDCErrors) {
                case 'CODE':
                    throw Boom.badRequest('If response_type includes "code" grant_type must include "authorization_code"');
                case 'ID_TOKEN':
                    throw Boom.badRequest('If response_type includes "id_token" grant_type must include "implicit"');
                case 'TOKEN':
                    throw Boom.badRequest('If response_type includes "token" grant_type must include "implicit"');
            }
            const result = await client.patchOne(req.authGroup, req.params.id, patched);
            delete result.client_secret;
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },

    async deleteOne(req, res, next) {
        try {
            if(!req.params.group) return next(Boom.preconditionRequired('Must provide Auth Group'));
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            if(req.params.id === req.authGroup.associatedClient) {
                return next(Boom.badRequest('You can not delete your Auth Group primary client'));
            }
            const result = await client.deleteOne(req.authGroup, req.params.id);
            if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
            return res.respond(say.ok(result, RESOURCE));
        } catch (error) {
            next(error);
        }
    },

    async clientOperations(req, res, next) {
        try {
            if(!req.params.id) return next(Boom.preconditionRequired('Must provide id'));
            await permissions.enforceOwn(req.permissions, req.params.id);
            if (!req.body.operation) return res.respond(say.noContent('Client Operation'));
            let result;
            switch (req.body.operation) {
                case "rotate_secret":
                    result = await client.rotateSecret(req.params.id, req.authGroup);
                    if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
                    return res.respond(say.ok(result, RESOURCE));
                case "rotate_registration_access_token":
                    result = await rat.regAccessToken(req.params.id, req.authGroup);
                    if (!result) return next(Boom.notFound(`id requested was ${req.params.id}`));
                    return res.respond(say.ok(result, RESOURCE));
                default:
                    throw Boom.badRequest('Unknown operation');
            }
        } catch (error) {
            console.info(error);
            next(error);
        }
    }
};

export default api;