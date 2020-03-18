import handleErrors from './customErrorHandler';
import { sayMiddleware } from './say';

export default {
    cores (req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, DELETE, PUT, PATCH, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, api_key, Authorization');
        next();
    },
    catch404: handleErrors.catch404,
    async catchErrors (err, req, res, next) {
        res.locals.message = err.message;
        res.locals.error = req.app.get('env') === 'development' ? err : {};
        const error = await handleErrors.parse(err);
        return res.respond(error);
    },
    responseIntercept: sayMiddleware.responseIntercept
}