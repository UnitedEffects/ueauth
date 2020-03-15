import express from 'express';
import path from 'path';
import logger from 'morgan';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import Boom from '@hapi/boom';

import index from './routes/index';
import api from './routes/api';
import IO from './io';
import handleErrors from './customErrorHandler';

const config = require('./config');
const app = express();

app.set('views', path.join(__dirname, '../views'));

// view engine setup
app.set('view engine', 'pug');
if(config.ENV!=='production') app.use(logger('tiny'));
app.use(bodyParser.json({ type: ['json', '+json'] }));
app.use(bodyParser.urlencoded({
    extended: false
}));

app.use(cookieParser());

app.use(express.static(path.join(__dirname, '../public')));
app.use('/swagger', express.static(path.join(__dirname, '../public/swagger')));


app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, DELETE, PUT, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, api_key, Authorization');
    next();
});

app.use('/', index);
app.use('/api', api);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    next(Boom.notFound('Resource not found.'));
});

// error handler
app.use(async (err, req, res, next) => {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    const error = await handleErrors.parse(err);
    return IO.respond(res, error);
});

// Handle uncaughtException
process.on('uncaughtException', (err) => {
    console.error('Caught exception:');
    console.error(err);
    console.error({
        error: 'UNCAUGHT EXCEPTION',
        stack: err.stack || err.message
    });
});

export default app;