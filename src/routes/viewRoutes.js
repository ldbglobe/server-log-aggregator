const express = require('express');
const router = express.Router();
const LogService = require('../services/LogService');

// Fonction pour formater les timestamps
function formatTimestamp(date) {
    if (!date) return 'Sans timestamp';
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
    router.get('/*', async (req, res) => {
        const servers = req.selectedServers;
        const serverKey = req.selectedserverKey;
        const logService = req.logService;

        console.log(`ViewRoutes initialized for serverKey: ${serverKey}`);

        const path = req.params[0];
        if (!path) {
            return res.status(400).send('Chemin non spécifié');
        }

        if (!LogService.isLogFileType(path)) {
            return res.status(400).send('Type de fichier non supporté. Seuls les fichiers .log et .gz sont acceptés.');
        }

        try {
            const logs = await logService.fetchFileContent(path);
            const sensitiveData = logService.scanForSensitiveData(logs);
            
            // Construire le fil d'Ariane
            const breadcrumbs = LogService.buildBreadcrumbs(path);
            
            // Count lines per server
            const serverLineCounts = {};
            for (const log of logs) {
                const serverId = log.server || 'unknown';
                serverLineCounts[serverId] = (serverLineCounts[serverId] || 0) + 1 + log.additionalLines.length;
            }
            
            let html = `
            <html>
            <head>
                <title>Logs - ${path}</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 2em;
                        background-color: #f7fafc;
                    }
                    .log-entries {
                        background: white;
                        padding: 1em;
                        border-radius: 8px;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    }
                    .server-legend {
                        display: flex;
                        gap: 1em;
                        margin-bottom: 1em;
                        padding: 0.5em;
                        background: #f8fafc;
                        border-radius: 4px;
                    }
                    .server-legend-item {
                        display: flex;
                        align-items: center;
                        gap: 0.5em;
                    }
                    .server-color {
                        width: 20px;
                        height: 20px;
                        border-radius: 4px;
                    }
                    ${Object.entries(servers).map(([id, server]) => `
                        .server-color.${id} {
                            background: ${server.color};
                        }
                    `).join('')}
                    .log-entry { 
                        margin-bottom: 1em;
                        padding: 0.5em;
                        border-bottom: 1px solid #e2e8f0;
                        border-left: 4px solid transparent;
                    }
                    .log-entry:last-child {
                        border-bottom: none;
                    }
                    ${Object.entries(servers).map(([id, server]) => `
                        .log-entry.${id} {
                            border-left-color: ${server.color};
                        }
                    `).join('')}
                    .timestamp { 
                        color: #2c5282; 
                        font-weight: bold;
                        margin-bottom: 0.25em;
                        font-family: monospace;
                        display: flex;
                        align-items: center;
                        gap: 1em;
                    }
                    .content { 
                        font-family: monospace; 
                        color: #2d3748;
                        background: #f8fafc;
                        padding: 0.5em;
                        border-radius: 4px;
                    }
                    .additional-line { 
                        font-family: monospace; 
                        color: #2d3748;
                        background: #f8fafc;
                        padding: 0.5em;
                        border-radius: 4px;
                    }
                    .line-number {
                        color: #718096;
                        font-size: 0.9em;
                        font-family: monospace;
                        background: #edf2f7;
                        padding: 0.2em 0.5em;
                        border-radius: 3px;
                    }
                    .line-content {
                        white-space: pre-wrap;
                    }
                    /* Styles pour le breadcrumb et l'en-tête */
                    .header-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 1.5em;
                    }
                    .breadcrumb {
                        display: flex;
                        align-items: center;
                        gap: 0.5em;
                        background: #f7fafc;
                        padding: 0.75em 1em;
                        border-radius: 6px;
                        border: 1px solid #e2e8f0;
                    }
                    .breadcrumb i {
                        margin-right: 0.5em;
                    }
                    .breadcrumb a {
                        color: #2c5282;
                        text-decoration: none;
                        font-weight: 500;
                    }
                    .breadcrumb a:hover {
                        text-decoration: underline;
                    }
                    .breadcrumb .separator {
                        color: #a0aec0;
                        font-size: 0.9em;
                    }
                    .breadcrumb .current {
                        color: #4a5568;
                        font-weight: 500;
                    }
                    .api-link {
                        display: inline-flex;
                        align-items: center;
                        gap: 0.5em;
                        background: #2c5282;
                        color: white;
                        text-decoration: none;
                        padding: 0.5em 1em;
                        border-radius: 4px;
                        font-weight: 500;
                        transition: background-color 0.2s;
                    }
                    .api-link:hover {
                        background: #2b6cb0;
                    }
                    .api-link i {
                        font-size: 0.9em;
                    }
                    /* Styles for search container */
                    .search-container {
                        display: flex;
                        gap: 0.5em;
                        margin-bottom: 1em;
                        align-items: center;
                    }
                    .search-input {
                        flex: 1;
                        padding: 0.5em;
                        border: 1px solid #e2e8f0;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 0.9em;
                    }
                    .search-input:focus {
                        outline: none;
                        border-color: #4299e1;
                        box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
                    }
                    .search-info {
                        color: #718096;
                        font-size: 0.9em;
                        white-space: nowrap;
                    }
                    .search-count {
                        background: #edf2f7;
                        padding: 0.2em 0.5em;
                        border-radius: 3px;
                        font-family: monospace;
                    }
                    .highlight {
                        background-color: #fefcbf;
                        border-radius: 2px;
                        padding:2px 0px;
                        position: relative;
                    }
                    .alert {
                        padding: 15px;
                        margin-bottom: 20px;
                        border: 1px solid transparent;
                        border-radius: 4px;
                    }
                    .alert-warning {
                        color: #856404;
                        background-color: #fff3cd;
                        border-color: #ffeeba;
                    }
                </style>
                <script>
                    function filterLogs() {
                        const searchInput = document.getElementById('logSearch');
                        const searchRegex = new RegExp(searchInput.value, 'i');
                        const logEntries = document.querySelectorAll('.log-entry');
                        let matchCount = 0;

                        logEntries.forEach(entry => {
                            const content = entry.querySelector('.line-content').textContent;
                            const additionalLines = entry.querySelectorAll('.additional-line .line-content');
                            let hasMatch = searchRegex.test(content);
                            
                            // Check additional lines
                            additionalLines.forEach(line => {
                                if (searchRegex.test(line.textContent)) {
                                    hasMatch = true;
                                }
                            });

                            if (hasMatch) {
                                entry.style.display = '';
                                matchCount++;
                                
                                // Highlight matches
                                const highlightContent = (text) => {
                                    return text.replace(searchRegex, match => 
                                        '<span class="highlight">' + match + '</span>'
                                    );
                                };
                                
                                entry.querySelector('.line-content').innerHTML = 
                                    highlightContent(content);
                                
                                additionalLines.forEach(line => {
                                    line.innerHTML = highlightContent(line.textContent);
                                });
                            } else {
                                entry.style.display = 'none';
                            }
                        });

                        // Update match count
                        document.getElementById('matchCount').textContent = matchCount;
                    }

                    // Debounce function to limit how often the search runs
                    function debounce(func, wait) {
                        let timeout;
                        return function executedFunction(...args) {
                            const later = () => {
                                clearTimeout(timeout);
                                func(...args);
                            };
                            clearTimeout(timeout);
                            timeout = setTimeout(later, wait);
                        };
                    }

                    // Initialize search functionality
                    window.addEventListener('load', function() {
                        const searchInput = document.getElementById('logSearch');
                        searchInput.addEventListener('input', debounce(filterLogs, 300));
                    });
                </script>
            </head>
            <body>
                <div class="header-container">
                    <div class="breadcrumb">
                        ${serverKey ? `<a href="/" class="server-key">${serverKey}</a> / ` : ''}
                        <a href="${LogService.buildPathUrl()}"><i class="fas fa-home"></i>racine</a>
                        ${breadcrumbs.map(link => `
                            <span class="separator">/</span>
                            ${link.isLast ? 
                                `<span class="current">${link.name}</span>` :
                                `<a href="${LogService.buildPathUrl(link.path)}">${link.name}</a>`
                            }
                        `).join('')}
                    </div>
                    <a href="/api/view/${LogService.normalizePath(path)}" class="api-link">
                        <i class="fas fa-code"></i>JSON
                    </a>
                </div>
                <header>
                    ${sensitiveData.length > 0 ? `
                        <div class="alert alert-warning">
                            <strong>Warning:</strong> Sensitive data detected in this file.
                            <ul>
                                ${sensitiveData.map(item => `
                                    <li>
                                        Line ${item.lineNumber}: ${item.sensitiveData} (Server: ${item.label})
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </header>
                <div class="log-entries">
                    <div class="search-container">
                        <input type="text" 
                               id="logSearch" 
                               class="search-input" 
                               placeholder="Rechercher dans les logs (regex supporté)..."
                               title="Utilisez des expressions régulières pour la recherche">
                        <span class="search-info">
                            <span id="matchCount">0</span> correspondances
                        </span>
                    </div>
                    <div class="server-legend">
                        ${Object.entries(servers).map(([id, server]) => `
                            <div class="server-legend-item">
                                <div class="server-color ${id}"></div>
                                <span>${server.label} (${serverLineCounts[id] || 0} lignes)</span>
                            </div>
                        `).join('')}
                    </div>
            `;

            for (const log of logs) {
                const serverClass = log.server || 'unknown';
                html += `
                    <div class="log-entry ${serverClass}">
                        <div class="timestamp">${formatTimestamp(log.timestamp)}</div>
                        <div class="content">
                            <span class="line-number">L${log.lineNumber}</span>
                            <span class="line-content">${log.content}</span>
                        </div>
                        ${log.additionalLines.length > 0 ? log.additionalLines.map(line => `
                            <div class="additional-line">
                                <span class="line-number">L${line.lineNumber}</span>
                                <span class="line-content">${line.content}</span>
                            </div>
                        `).join('') : ''}
                    </div>
                `;
            }

            html += `
                </div>
            </body>
            </html>
            `;
            res.send(html);
        } catch (error) {
            console.error('Erreur lors de la récupération du fichier:', error);
            res.status(500).send(`
                <html>
                <head>
                    <title>Erreur</title>
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
                            Erreur lors de la récupération du fichier
                        </h2>
                        <p class="error-message">${error.message}</p>
                        <a href="/path/${path.split('/').slice(0, -1).join('/')}" class="back-link">
                            <i class="fas fa-arrow-left"></i>
                            Retour à la liste
                        </a>
                    </div>
                </body>
                </html>
            `);
        }
    });

    return router;
};