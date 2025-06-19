const express = require('express');
const router = express.Router();
const LogService = require('../services/LogService');

module.exports = () => {
    router.get('/path/:serverGroup/*', async (req, res) => {
        const logService = req.logService;
        const path = req.params[0];
        try {
            const data = await logService.aggregateLogs(path);
            res.json(data);
        } catch (error) {
            console.error('Error while fetching logs:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/view/:serverGroup/*', async (req, res) => {
        const logService = req.logService;
        const path = req.params[0];
        if (!path) {
            return res.status(400).json({ error: 'Path not specified' });
        }

        if (!LogService.isLogFileType(path)) {
            return res.status(400).json({ error: 'Unsupported file type. Only .log and .gz files are accepted.' });
        }

        try {
            const logs = await logService.fetchFileContent(path);
            res.json(logs);
        } catch (error) {
            console.error('Error while fetching the file:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/raw/:serverGroup/:serverId/*', async (req, res) => {
        const logService = req.logService;
        const serverId = req.params.serverId;
        const filePath = req.params[0];

        if (!serverId || !filePath) {
            return res.status(400).json({ error: 'Server ID or path not specified' });
        }

        try {
            const rawLog = await logService.fetchRawLog(serverId, filePath);
            res.type('text/plain');
            rawLog.pipe(res);
        } catch (error) {
            console.error('Error while fetching raw file:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/scan/:serverGroup/*', async (req, res) => {
        const logService = req.logService;
        const path = req.params[0];
        if (!path) {
            return res.status(400).json({ error: 'Path not specified' });
        }

        try {
            const logs = await logService.fetchFileContent(path);
            const sensitiveData = logService.scanForSensitiveData(logs);
            res.json(sensitiveData);
        } catch (error) {
            console.error('Error while scanning for sensitive data:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};