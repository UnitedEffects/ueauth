import express from 'express';
import path from 'path';
import logger from 'morgan';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';

import { Root, Api, OIDC } from './routes';
import middle from './middleware';

const config = require('./config');
const app = express();

app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'pug');
if(config.ENV!=='production') app.use(logger('tiny'));

app.use('/api/**', bodyParser.json({ type: ['json', '+json'] }));
app.use('/api/**', bodyParser.urlencoded({
    extended: false
}));

app.use(cookieParser());
app.use(middle.cores);
app.use(middle.responseIntercept);

//content and APIs
app.use(express.static(path.join(__dirname, '../public')));
app.use('/', Root);
app.use('/', OIDC);
app.use('/api', Api);

// catch 404 and other errors
app.use(middle.catch404);
app.use(middle.catchErrors);

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