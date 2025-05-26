const express = require('express');
const router = express.Router();
const LogService = require('../services/LogService');

module.exports = (logService) => {
    router.get('/path/*', async (req, res) => {
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

    router.get('/scan/*', async (req, res) => {
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