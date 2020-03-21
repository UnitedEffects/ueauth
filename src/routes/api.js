import express from 'express';
import log from '../api/logging/api';
import m from '../middleware';
const router = express.Router();
const p = require('../../package.json');
const date = new Date();

router.get('/version', (req, res) => {
    res.json( {
        err: null,
        message: {
            api: 'Boilerplate',
            version: p.version,
            baseURL: '/api',
            copyright: `Copyright (c) ${date.getFullYear()} theBoEffect LLC`
        }
    });
});

// Log and Health
router.get('/logs', log.getLogs);
router.get('/logs/:id', log.getLog);
router.post('/logs', [m.schemaCheck], log.writeLog);
router.patch('/logs/:id', [m.schemaCheck], log.patchLog); //For Example Only

router.get('/health', (req, res) => {
    res.json({data: {server: 'running'}});
});

module.exports = router;
