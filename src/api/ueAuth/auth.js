import passport from 'passport';
import {Strategy as BearerStrategy} from 'passport-http-bearer';
import moment from 'moment';
import Token from './model';
import log from '../logging/logs';
import config from '../../config';
import helper from '../../helper';
import ac from "./roleAccess";
import axios from 'axios';

const writeLogsToDB = true;

passport.use('bearer', new BearerStrategy(
    async (accessToken, callback) => {
        try {
            if (!accessToken) return callback(null, false);
            const fullToken = Buffer.from(accessToken.replace(/%3D/g, '='), 'base64').toString('ascii');
            const lookup = fullToken.split('.');
            if (!lookup.length >= 2) return callback(null, false);
            const userId = (lookup[0]) ? lookup[0] : null;
            const tokenVal = (lookup[1]) ? lookup[1] : null;
            const product =  (lookup[2]) ? lookup[2] : null;
            const domain = (lookup[3]) ? lookup[3] : null;

            if(!product) return callback(null, false);
            if(!domain) return callback(null, false);

            const tokens  = await Token.find({ user_id: userId, product_slug: product, domain_slug: domain });
            const token = await ueAuthFactory.findToken(tokens, tokenVal, accessToken);
            if(!token) return getBearerToken(accessToken, (err, result) => callback(err, result));
            return callback(null, token.user);
        }catch(error){
            error['detail']='Unhandled Error caught at Bearer Auth';
            log.error('Unhandled Error caught at Bearer Auth');
            return callback(error, false);
        }
    }
));

passport.use('bearerOptional', new BearerStrategy(
    async (accessToken, callback) => {
        try {
            if (!accessToken) return callback(null, false);
            if (accessToken === 'anon') return callback(null, { anon: true });
            const fullToken = Buffer.from(accessToken.replace(/%3D/g, '='), 'base64').toString('ascii');
            const lookup = fullToken.split('.');
            if (!lookup.length >= 2) return callback(null, { anon: true });
            const userId = (lookup[0]) ? lookup[0] : null;
            const tokenVal = (lookup[1]) ? lookup[1] : null;
            const product =  (lookup[2]) ? lookup[2] : null;
            const domain = (lookup[3]) ? lookup[3] : null;

            if(!product) return callback(null, { anon: true });
            if(!domain) return callback(null, { anon: true });

            const tokens  = await Token.find({ user_id: userId, product_slug: product, domain_slug: domain });
            const token = await ueAuthFactory.findToken(tokens, tokenVal, accessToken);
            if(!token) return getBearerToken(accessToken, (err, result) => {
                if(!result) return callback(null, { anon: true });
                return callback(err, result)
            });
            return callback(null, token.user);
        }catch(error){
            error['detail']='Unhandled Error caught at Bearer Auth';
            log.error('Unhandled Error caught at Bearer Auth', writeLogsToDB);
            return callback(error, { anon: true });
        }
    }
));

async function getBearerToken(accessToken, callback){
    try {
        const fullToken = Buffer.from(accessToken.replace(/%3D/g, '='), 'base64').toString('ascii');
        const lookup = fullToken.split('.');
        const response = await axios.get(`${config.UEAUTH.TOKENURL}/api/validate`, { headers: { authorization: `bearer ${accessToken}`}});
        if (response.status !== 200) return callback(null, false);
        const returned = (helper.isJson(response.data)) ? JSON.parse(response.data) : response.data;
        if(returned.data.role !== 1 && returned.data.activity.product!==config.UEAUTH.PRODUCT_SLUG) return callback(null, false);
        try {
            await ueAuthFactory.saveToken(returned.data, {product: lookup[2] || null, domain: lookup[3] || null}, lookup[1]);
        } catch (error) {
            log.error('Unable to cache the token after validation.', writeLogsToDB);
        }
        return callback(null, returned.data);
    } catch (error) {
        error["detail"] = 'Bearer Auth validation error from domain service.';
        return callback(error, false);
    }
}

passport.serializeUser((user, done) => {
    done(null, user._id);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

async function find (arr, val) {
    let result = null;
    for (let elm of arr) {
        if(await elm.verifyTokenAsync(val)){
            result = elm;
            break;
        }
    }
    return result;
}

const ueAuthFactory = {
    async findToken(tokens, val, access) {
        try {
            const theToken = await find(tokens, val);
            if(theToken) {
                theToken.user['token'] = access;
                theToken.user['expires'] = moment.utc(theToken.created).add(12, 'hours').format();
                theToken.user['token_created'] = theToken.created;
            }
            return theToken;
        } catch (error) {
            log.error(error, writeLogsToDB);
            return null;
        }
    },
    async saveToken(user, access, tokenVal) {
        const toks = await Token.find({user_id: user._id, product_slug: access.product, domain_slug: access.domain});
        if(toks.length > 5) await Token.remove({_id: toks[0]._id});
        const tCreated = user.token_created;

        const temp = JSON.parse(JSON.stringify(user));
        delete temp.token;
        delete temp.token_created;
        delete temp.expires;

        const token = new Token({
            value: tokenVal,
            user_id: user._id,
            product_slug: access.product,
            domain_slug: access.domain,
            user: temp,
            created: tCreated
        });

        return token.save();
    },
    async own (req, resourceOwner) {
        try {
            const roles = await this.getRole(req.user, this.getDomain(req));
            const userId = req.user._id;
            let resource = req.path.split('/')[1];
            if (resource === '') resource = 'root';
            let access = false;
            for (let i=0; i<roles.length; i++) {
                if (access === false){
                    access = await this.checkRole('own', access, roles[i], req.method, resource, userId, resourceOwner);
                }
            }
            return access;
        } catch (error) {
            log.error(error, writeLogsToDB);
            throw error;
        }
    },
    async checkRole(type, access, role, method, resource, userId = null, resourceOwner = null) {
        try {
            switch (type) {
                case 'any':
                    switch (method) {
                        case 'GET':
                            if (!access) return (ac.can(role).readAny(resource).granted);
                            return access;
                        case 'PATCH':
                        case 'PUT':
                            if (!access) return (ac.can(role).updateAny(resource).granted);
                            return access;
                        case 'DELETE':
                            if (!access) return (ac.can(role).deleteAny(resource).granted);
                            return access;
                        case 'POST':
                            if (!access) return (ac.can(role).createAny(resource).granted);
                            return access;
                        default:
                            return access;
                    }
                case 'own':
                    switch (method) {
                        case 'GET':
                            if (!access) return (ac.can(role).readOwn(resource).granted && userId === resourceOwner);
                            return access;
                        case 'PATCH':
                        case 'PUT':
                            if (!access) return (ac.can(role).updateOwn(resource).granted && userId === resourceOwner);
                            return access;
                        case 'DELETE':
                            if (!access) return (ac.can(role).deleteOwn(resource).granted && userId === resourceOwner);
                            return access;
                        case 'POST':
                            if (!access) return (ac.can(role).createOwn(resource).granted && userId === resourceOwner);
                            return access;
                        default:
                            return access;
                    }
                default:
                    return access;

            }
        } catch (error) {
            log.error(error.message, writeLogsToDB);
            return false;
        }
    },
    getDomain (req) {
        try {
            if(req.params.domain) return req.params.domain;
            if(req.query.domain) return req.query.domain;
            if(req.body.domain) return req.body.domain;
            if(req.headers.domain) return req.headers.domain;
            if(req.params.domain_slug) return req.params.domain_slug;
            if(req.query.domain_slug) return req.query.domain_slug;
            if(req.body.domain_slug) return req.body.domain_slug;
            if(req.headers.domain_slug) return req.headers.domain_slug;
            if(req.params.domainSlug) return req.params.domainSlug;
            if(req.query.domainSlug) return req.query.domainSlug;
            if(req.body.domainSlug) return req.body.domainSlug;
            if(req.headers.domainSlug) return req.headers.domainSlug;
            return undefined;
        } catch (e) {
            throw e;
        }
    },
    getRole (user, domain) {
        try {
            const role = [];
            if(user.role===1) role.push('superAdmin');
            if(user.permissions) if(user.permissions.product) if(user.permissions.product[config.PRODUCT_SLUG]) {
                if(user.permissions.product[config.PRODUCT_SLUG].admin) role.push('productAdmin');
            }
            if(domain){
                if(user.permissions) if(user.permissions.domain) if(user.permissions.domain[domain]) {
                    if(user.permissions.domain[domain].admin) role.push('domainAdmin');
                }
            }
            if(role.length===0) role.push('guest');
            return Promise.resolve(role);
        } catch (e) {
            return Promise.reject(e);
        }
    },
    validProductAdmin (user) {
        if(user.role === 1) return true;
        else if(user.activity) if (user.activity.product) if(user.permissions) if(user.permissions.product) if(user.permissions.product[user.activity.product]) {
            if(user.permissions.product[user.activity.product].admin || user.permissions.product[user.activity.product].manager) return true;
        }
        return false;
    },
    validProductAdminOnly (user) {
        if(user.role === 1) return true;
        else if(user.activity) if (user.activity.product) if(user.permissions) if(user.permissions.product) if(user.permissions.product[user.activity.product]) {
            return user.permissions.product[user.activity.product].admin;
        }
        return false;
    },
    validDomainAdmin (user) {
        if(user.role === 1) return true;
        else if(user.activity) if (user.activity.domain) if(user.permissions) if(user.permissions.domain) if(user.permissions.domain[user.activity.domain]) {
            if(user.permissions.domain[user.activity.domain].admin || user.permissions.domain[user.activity.domain].manager) return true;
        }
        return false;
    },
    validDomainAdminOnly (user) {
        if(user.role === 1) return true;
        else if(user.activity) if (user.activity.domain) if(user.permissions) if(user.permissions.domain) if(user.permissions.domain[user.activity.domain]) {
            return user.permissions.domain[user.activity.domain].admin;
        }
        return false;
    },
    validAdmin (user) {
        if(user.role === 1) return true;
        else if(this.validProductAdmin(user)) return true;
        else if(this.validDomainAdmin(user)) return true;
        return false;
    },
    validAdminOnly (user) {
        if(user.role === 1) return true;
        else if(this.validProductAdminOnly(user)) return true;
        else if(this.validDomainAdminOnly(user)) return true;
        return false;
    },
    thisValidAdmin (user, product, domain) {
        if(user.role === 1) return true;
        else if(this.thisValidProductAdmin(user, product)) return true;
        else if(this.thisValidDomainAdmin(user, domain)) return true;
        return false;
    },
    thisValidAdminOnly (user, product, domain) {
        if(user.role === 1) return true;
        else if(this.thisValidProductAdminOnly(user, product)) return true;
        else if(this.thisValidDomainAdminOnly(user, domain)) return true;
        return false;
    },
    thisValidProductAdminOnly (user, product) {
        if(user.role === 1) return true;
        else if(user.permissions) if(user.permissions.product) if(user.permissions.product[product]) {
            return user.permissions.product[product].admin;
        }
        return false;
    },
    thisValidProductAdmin (user, product = config.PRODUCT_SLUG) {
        if(user.role === 1) return true;
        else if(user.permissions) if(user.permissions.product) if(user.permissions.product[product]) {
            if(user.permissions.product[product].admin || user.permissions.product[product].manager) return true;
        }
        return false;
    },
    thisValidDomainAdmin (user, domain) {
        if(user.role === 1) return true;
        else if(user.permissions) if(user.permissions.domain) if(user.permissions.domain[domain]) {
            if(user.permissions.domain[domain].admin || user.permissions.domain[domain].manager) return true;
        }
        return false;
    },
    thisValidDomainAdminOnly (user, domain) {
        if(user.role === 1) return true;
        else if(user.permissions) if(user.permissions.domain) if(user.permissions.domain[domain]) {
            return user.permissions.domain[domain].admin;
        }
        return false;
    },
    isBearerAuthenticated: passport.authenticate('bearer', { session: false }),
    isOptionalAuthenticated: passport.authenticate('bearerOptional', { session: false }),
};

export default ueAuthFactory;