const express = require('express');
const router = express.Router();
const LogService = require('../services/LogService');
const config = require('../config');

// Function to format timestamps
function formatTimestamp(date) {
    if (!date) return 'No timestamp';
    return date.toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

module.exports = () => {
    router.get('/:serverGroup/*', async (req, res) => {
        const serverKey = req.params.serverGroup;
        const servers = req.selectedServers;
        const logService = req.logService;
        const path = req.params[0];
        console.log(`Fetching logs for path: ${path} in server group: ${serverKey}`);
        if (!path) {
            return res.status(400).send('Path not specified');
        }
        if (!LogService.isLogFileType(path)) {
            return res.status(400).send('Unsupported file type. Only .log and .gz files are accepted.');
        }
        try {
            const logs = await logService.fetchFileContent(path);
            const sensitiveData = logService.scanForSensitiveData(logs);
            const breadcrumbs = LogService.buildBreadcrumbs(path).map(link => ({
                name: link.name,
                url: LogService.buildPathUrl(link.path, '', serverKey),
                isLast: link.isLast
            }));
            const rootUrl = LogService.buildPathUrl('', '', serverKey);
            // Calcul du nombre total de lignes par serveur
            const lineCountsByServer = {};
            logs.forEach(log => {
                if (Array.isArray(log.servers)) {
                    log.servers.forEach(id => {
                        lineCountsByServer[id] = (lineCountsByServer[id] || 0) + 1;
                    });
                }
            });
            // Préparation des couleurs, labels et nombre de lignes des serveurs
            const serverInfos = Object.entries(servers).map(([id, srv]) => ({
                id,
                label: srv.label,
                color: srv.color || '#ccc',
                lineCount: lineCountsByServer[id] || 0
            }));
            // Préparation des logs pour le template
            const logsForView = logs.map(log => {
                const serversForLog = (log.servers && log.servers.length > 0)
                    ? log.servers.map(id => ({
                        id,
                        label: servers[id]?.label || id,
                        color: servers[id]?.color || '#ccc'
                    }))
                    : [{ id: 'unknown', label: 'unknown', color: '#ccc' }];
                // Prépare chaque ligne (principale + additionalLines)
                const allLines = [log.content, ...(log.additionalLines || [])];
                const lines = allLines.map(raw => {
                    let isJson = false;
                    let formatted = raw;
                    try {
                        const parsed = JSON.parse(raw);
                        if (typeof parsed === 'object') {
                            formatted = JSON.stringify(parsed, null, 2);
                            isJson = true;
                        }
                    } catch (e) {}
                    return { raw, formatted, isJson };
                });
                let isJson = lines.some(line => line.isJson);
                return {
                    servers: serversForLog,
                    lineNumber: log.lineNumber,
                    timestamp: log.timestamp ? formatTimestamp(log.timestamp) : '',
                    lineCount: lines.length,
                    isJson,
                    lines,
                    sensitive: sensitiveData.some(item => item.lineNumber === log.lineNumber && serversForLog.some(s => s.label === item.label)),
                };
            });
            res.render('view', {
                serverKey,
                rootUrl,
                breadcrumbs,
                serverInfos,
                logs: logsForView
            });
        } catch (error) {
            console.error('Error while fetching the file:', error);
            res.status(500).send(`
                <html>
                <head>
                    <title>Error</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 2em; }
                        .error-container {
                            background: #fff5f5;
                            border: 1px solid #feb2b2;
                            border-radius: 8px;
                            padding: 1.5em;
                            margin: 1em 0;
                        }
                        .error-title {
                            color: #c53030;
                            margin: 0 0 1em 0;
                            display: flex;
                            align-items: center;
                            gap: 0.5em;
                        }
                        .error-message {
                            color: #4a5568;
                            margin: 0;
                        }
                        .back-link {
                            display: inline-flex;
                            align-items: center;
                            gap: 0.5em;
                            color: #2c5282;
                            text-decoration: none;
                            margin-top: 1em;
                        }
                        .back-link:hover {
                            text-decoration: underline;
                        }
                    </style>
                </head>
                <body>
                    <div class="error-container">
                        <h2 class="error-title">
                            <i class="fas fa-exclamation-circle"></i>
                            Error while fetching the file
                        </h2>
                        <p class="error-message">${error.message}</p>
                        <a href="/path/${path.split('/').slice(0, -1).join('/')}" class="back-link">
                            <i class="fas fa-arrow-left"></i>
                            Back to list
                        </a>
                    </div>
                </body>
                </html>
            `);
        }
    });

    return router;
};