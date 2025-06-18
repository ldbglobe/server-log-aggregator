const express = require('express');
const router = express.Router();
const LogService = require('../services/LogService');

module.exports = () => {
    router.get('/path/*', async (req, res) => {
        const servers = req.selectedServers;
        const serverKey = req.selectedserverKey;
        const logService = req.logService;
        const path = req.params[0];
        try {
            const data = await logService.aggregateLogs(path);
            res.json(data);
        } catch (error) {
            console.error('Erreur lors de la récupération des logs:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/view/*', async (req, res) => {
        const servers = req.selectedServers;
        const serverKey = req.selectedserverKey;
        const logService = req.logService;
        const path = req.params[0];
        if (!path) {
            return res.status(400).json({ error: 'Chemin non spécifié' });
        }

        if (!LogService.isLogFileType(path)) {
            return res.status(400).json({ error: 'Type de fichier non supporté. Seuls les fichiers .log et .gz sont acceptés.' });
        }

        try {
            const logs = await logService.fetchFileContent(path);
            res.json(logs);
        } catch (error) {
            console.error('Erreur lors de la récupération du fichier:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/raw/:serverId/*', async (req, res) => {
        const servers = req.selectedServers;
        const serverKey = req.selectedserverKey;
        const logService = req.logService;
        const serverId = req.params.serverId;
        const filePath = req.params[0];

        if (!serverId || !filePath) {
            return res.status(400).json({ error: 'Identifiant du serveur ou chemin non spécifié' });
        }

        try {
            const rawLog = await logService.fetchRawLog(serverId, filePath);
            res.type('text/plain');
            rawLog.pipe(res);
        } catch (error) {
            console.error('Erreur lors de la récupération du fichier brut:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/scan/*', async (req, res) => {
        const servers = req.selectedServers;
        const serverKey = req.selectedserverKey;
        const logService = req.logService;
        const path = req.params[0];
        if (!path) {
            return res.status(400).json({ error: 'Chemin non spécifié' });
        }

        try {
            const logs = await logService.fetchFileContent(path);
            const sensitiveData = logService.scanForSensitiveData(logs);
            res.json(sensitiveData);
        } catch (error) {
            console.error('Erreur lors de l’analyse des données sensibles:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};