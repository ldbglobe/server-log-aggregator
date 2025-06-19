const express = require('express');
const router = express.Router();
const LogService = require('../services/LogService');

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
    router.get('/*', async (req, res) => {
        const servers = req.selectedServers;
        const serverKey = req.selectedserverKey;
        const logService = req.logService;

        console.log(`ViewRoutes initialized for serverKey: ${serverKey}`);

        const path = req.params[0];
        if (!path) {
            return res.status(400).send('Path not specified');
        }

        if (!LogService.isLogFileType(path)) {
            return res.status(400).send('Unsupported file type. Only .log and .gz files are accepted.');
        }

        try {
            const logs = await logService.fetchFileContent(path);
            const sensitiveData = logService.scanForSensitiveData(logs);
            
            // Build breadcrumbs
            const breadcrumbs = LogService.buildBreadcrumbs(path);
            
            // Count lines per server
            const serverLineCounts = {};
            for (const log of logs) {
                if (log.servers && Array.isArray(log.servers) && log.servers.length > 0) {
                    for (const serverId of log.servers) {
                        serverLineCounts[serverId] = (serverLineCounts[serverId] || 0) + 1 + log.additionalLines.length;
                    }
                } else {
                    const serverId = 'unknown';
                    serverLineCounts[serverId] = (serverLineCounts[serverId] || 0) + 1 + log.additionalLines.length;
                }
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
                        display: flex;
                        flex-direction: row;
                        flex-wrap: wrap;
                        align-items: stretch;
                    }
                    .log-entry:last-child {
                        border-bottom: none;
                    }
                    .server-colored-line {
                        width:0;
                        margin-right:2px;
                    }
                    ${Object.entries(servers).map(([id, server]) => `
                        .server-colored-line.${id} {
                            border-left: 8px solid ${server.color};
                        }
                    `).join('')}
                    .header { 
                        color: #2c5282; 
                        font-weight: bold;
                        margin-bottom: 0.25em;
                        font-family: monospace;
                        display: flex;
                        align-items: center;
                        width: 100%;
                    }
                    .content { 
                        font-family: monospace; 
                        color: #2d3748;
                        background: #f8fafc;
                        padding: 0.5em;
                        border-radius: 4px;
                        overflow-x: auto;
                        flex: 1;
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
                    .fold-btn, .fold-all-btn {
                        cursor: pointer;
                        background: #e2e8f0;
                        border: none;
                        border-radius: 4px;
                        padding: 0.2em 0.7em;
                        margin-right: 0.7em;
                        font-size: 1em;
                        color: #2c5282;
                        transition: background 0.15s, color 0.15s;
                        outline: none;
                        box-shadow: 0 1px 2px rgba(44,82,130,0.04);
                    }
                    .fold-btn:hover, .fold-btn:focus {
                        background: #bee3f8;
                        color: #2b6cb0;
                    }
                    .fold-content {
                        flex: 1;
                    }
                    .fold-content.folded {
                        max-height: 4em;
                        overflow: hidden;
                    }
                    .fold-content.folded .line-content {
                        white-space: normal;
                    }
                </style>
                <script>
                    function toggleFold(id) {
                        const entry = document.getElementById(id);
                        const foldContent = entry.querySelector('.fold-content');
                        const btn = entry.querySelector('.fold-btn');
                        foldContent.classList.toggle('folded');
                        btn.textContent = foldContent.classList.contains('folded') ? '+' : '−';
                    }
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
                        <a href="${LogService.buildPathUrl()}"><i class="fas fa-home"></i>root</a>
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
                               placeholder="Search logs (regex supported)..."
                               title="Use regular expressions for search">
                        <span class="search-info">
                            <span id="matchCount">0</span> matches
                        </span>
                    </div>
                    <div class="server-legend">
                        ${Object.entries(servers).map(([id, server]) => `
                            <div class="server-legend-item">
                                <div class="server-color ${id}"></div>
                                <span>${server.label} (${serverLineCounts[id] || 0} lines)</span>
                            </div>
                        `).join('')}
                    </div>
                    <div style="margin-bottom: 1em; display: flex; gap: 1em;">
                        <button class="fold-all-btn" onclick="
                            document.querySelectorAll('.fold-content').forEach(fc => fc.classList.add('folded'));
                            document.querySelectorAll('.fold-btn').forEach(btn => btn.textContent = '+');
                        ">Fold All</button>
                        <button class="fold-all-btn" onclick="
                            document.querySelectorAll('.fold-content').forEach(fc => fc.classList.remove('folded'));
                            document.querySelectorAll('.fold-btn').forEach(btn => btn.textContent = '−');
                        ">Unfold All</button>
                    </div>
            `;

            const formatContent = (content) => {
                try {
                    // Detect if content is JSON (object or array)
                    const trimmed = content.trim();
                    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                        const parsed = JSON.parse(trimmed);
                        if(parsed && typeof parsed === 'object') {
                            // Format JSON with indentation
                            return JSON.stringify(parsed, null, 2);
                        }
                    }
                } catch (e) {
                    // Not JSON, fall through
                }
                return content;
            }

            for (const [i, log] of logs.entries()) {
                const logId = `log-entry-${i}`;
                // Join all serverIds for CSS class, fallback to 'unknown'
                const serverClass = (log.servers && log.servers.length > 0) ? log.servers.join(' ') : 'unknown';
                // Optionally, display all serverIds in the UI as well
                const serverDisplay = (log.servers && log.servers.length > 0) ? log.servers.join(',') : 'unknown';
                // Create HTML for each log entry
                html += `
                    <div class="log-entry ${serverClass}" id="${logId}">
                        <div class="header">
                            <button class="fold-btn" onclick="toggleFold('${logId}')">−</button>
                            ${formatTimestamp(log.timestamp)} [${serverDisplay}]
                        </div>
                        ${log.servers.map(serverId => `
                            <div class="server-colored-line ${serverId}"></div>
                        `).join('')}
                        <div class="fold-content">
                            <div class="content">
                                <span class="line-number">L${log.lineNumber}</span>
                                <span class="line-content">${formatContent(log.content)}</span>
                            </div>
                            ${log.additionalLines.length > 0 ? log.additionalLines.map(line => `
                                <div class="additional-line">
                                    <span class="line-number">L${line.lineNumber}</span>
                                    <span class="line-content">${formatContent(line.content)}</span>
                                </div>
                            `).join('') : ''}
                        </div>
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