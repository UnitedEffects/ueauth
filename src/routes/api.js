const express = require('express');
const router = express.Router();
import log from '../api/logging/api';
const pack = require('../../package.json');

router.get('/version', (req, res) => {
    res.json( {
        err: null,
        message: {
            api: 'Boilerplate',
            version: pack.version,
            baseURL: '/api',
            copyright: 'Copyright (c) 2020 theBoEffect LLC'
        }
    });
});

// Log and Health
router.get('/logs', log.getLogs);
router.get('/logs/:id', log.getLog);
router.post('/logs', log.writeLog);
router.patch('/logs/:id', log.patchLog); //For Example Only

router.get('/health', (req, res) => {
    res.json({data: {server: 'running'}});
});

module.exports = router;
