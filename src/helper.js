import { createQuery } from 'odata-v4-mongodb'
import Boom from '@hapi/boom';

export default {
    /**
     * Checks string to see if its JSON
     * @param check
     * @returns {boolean}
     */
    isJson(check) {
        try {
            JSON.parse(check);
            return true;
        } catch (e) {
            return false;
        }
    },
    elementExists(property, check, arr) {
        return arr.some((el) => {
            return el[property] === check;
        });
    },
    async parseOdataQuery (data) {
        try {
            let query = null;
            if (data.$filter) {
                query = (query === null) ? `$filter=${data.$filter}` : `${query}&$filter=${data.$filter}`;
            }
            if (data.$select) {
                query = (query === null) ? `$select=${data.$select}` : `${query}&$select=${data.$select}`;
            }
            if (data.$skip) {
                query = (query === null) ? `$skip=${data.$skip}` : `${query}&$skip=${data.$skip}`;
            }
            if (data.$top) {
                query = (query === null) ? `$top=${data.$top}` : `${query}&$top=${data.$top}`;
            }
            if (data.$orderby) {
                query = (query === null) ? `$orderby=${data.$orderby}` : `${query}&$orderby=${data.$orderby}`;
            }
            return createQuery(query);
        } catch (error) {
            throw Boom.badRequest('Check your oData inputs', data);
        }

    },
    protectedNames(x) {
        const protecedNamespaces = [
            'api',
            'swagger',
            'swagger.json',
            'ueauth',
            'auth',
            'ue-auth',
            'authenticate',
            'authorize',
            'oidc',
            'oauth',
            'oauth2',
            'group',
            'authgroup',
            'auth-group',
            'usergroup',
            'user-group',
            'account',
            'logs',
            'client',
            'interaction',
            'health',
            'version',
            'groupcheck',
            'group-check',
            'login',
            'logout',
            'access',
            'token',
            'reg',
            'registration',
            'certs',
            'session',
            'me',
            'device',
            'introspection',
            'operation'
        ];
        return protecedNamespaces.includes(x.toLowerCase());
    }
};