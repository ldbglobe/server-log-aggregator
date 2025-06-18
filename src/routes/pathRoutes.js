const express = require('express');
const router = express.Router();
const LogService = require('../services/LogService');

module.exports = () => {
    router.get('/*', async (req, res) => {
        const servers = req.selectedServers;
        const serverKey = req.selectedserverKey;
        const logService = req.logService;
        const path = req.params[0] || '';
        const data = await logService.aggregateLogs(path);

        console.log(`PathRoutes initialized for serverKey: ${serverKey}`);
        
        // Construire le fil d'Ariane
        const breadcrumbs = LogService.buildBreadcrumbs(path);
        
        let html = `
            <html>
            <head>
                <title>Comparatif logs Nginx</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                <style>
                    body { font-family: Arial, sans-serif; margin: 2em; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
                    th { background: #f0f0f0; }
                    tr.sync td { background: #eaffea; }
                    tr.diff td { background: #fffbe6; color: #b59a00; }
                    tr.sync:nth-child(even) td { background: #d8f5d8; }
                    tr.diff:nth-child(even) td { background: #fff3d8; }
                    .mono { font-family: monospace; }
                    .folder-link { color: #2c5282; }
                    .folder-link i { margin-right: 5px; }
                    .file-link { color: #2d3748; }
                    .file-link i { margin-right: 5px; }
                    .link-container { color: #2d374888; }
                    .link-container i { margin-right: 5px; }
                    .size-warning { color: #e53e3e; }
                    .size-warning i { margin-left: 5px; }
                    .size-warning-text { color: #e53e3e; font-weight: bold; }
                    .server-info {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        font-size: 0.9em;
                        position: relative;
                    }
                    .server-info .date {
                        flex: 3;
                        color: #718096;
                        white-space: nowrap;
                    }
                    .server-info .size {
                        flex: 2;
                        text-align: right;
                        white-space: nowrap;
                    }
                    .server-info .direct-link {
                        flex: 1;
                        text-align: right;
                    }
                    .server-info .direct-link a {
                        color: #2c5282;
                        text-decoration: none;
                    }
                    .server-info .direct-link a:hover {
                        text-decoration: underline;
                    }
                    .server-info .direct-link i {
                        margin-right: 4px;
                    }
                    .server-info.unavailable {
                        color: #e53e3e;
                    }
                    /* Styles pour la modale */
                    .modal {
                        display: none;
                        position: fixed;
                        z-index: 1;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0,0,0,0.4);
                    }
                    .modal-content {
                        background-color: #fefefe;
                        margin: 15% auto;
                        padding: 20px;
                        border: 1px solid #888;
                        width: 80%;
                        max-width: 500px;
                        border-radius: 8px;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    }
                    .modal-header {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        margin-bottom: 15px;
                        color: #e53e3e;
                    }
                    .modal-header i {
                        font-size: 1.5em;
                    }
                    .modal-buttons {
                        display: flex;
                        justify-content: flex-end;
                        gap: 10px;
                        margin-top: 20px;
                    }
                    .modal-button {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    }
                    .modal-button.cancel {
                        background-color: #e2e8f0;
                        color: #4a5568;
                    }
                    .modal-button.proceed {
                        background-color: #e53e3e;
                        color: white;
                    }
                    .modal-button:hover {
                        opacity: 0.9;
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
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div class="breadcrumb">
                        ${serverKey ? `<a href="/" class="server-key">${serverKey}</a> / ` : ''}
                        <a href="${LogService.buildPathUrl()}"><i class="fas fa-home"></i>Racine</a>
                        ${breadcrumbs.map(link => `
                            <span class="separator">/</span>
                            ${link.isLast ? 
                                `<span class="current">${link.name}</span>` :
                                `<a href="${LogService.buildPathUrl(link.path)}">${link.name}</a>`
                            }
                        `).join('')}
                    </div>
                    <a href="/api/path/${LogService.normalizePath(path)}" class="api-link">
                        <i class="fas fa-code"></i>JSON
                    </a>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Nom</th>
                            ${Object.entries(servers).map(([id, server]) => `
                                <th>${server.label}</th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
            `;

            for (const entry of data) {
                // Vérifier si tous les serveurs ont le fichier
                const isSync = Object.keys(servers).every(serverId => entry[serverId]);
                const rowClass = isSync ? 'sync' : 'diff';
                
                const isDirectory = entry.isDirectory;
                const isLogFile = entry.isLogFileType;
                const isArchive = entry.isArchiveFile;
                
                const icon = isDirectory ? 'fa-folder' : 
                            isArchive ? 'fa-file-zipper' :
                            isLogFile ? 'fa-file-lines' : 'fa-file';
                const linkClass = isDirectory ? 'folder-link' : 'file-link';
                
                html += `<tr class="${rowClass}">
                    <td class="mono">
                        <div class="link-container">
                            ${isDirectory ? 
                                `<a href="${LogService.buildPathUrl(path, entry.name)}" class="${linkClass}">
                                    <i class="fas ${icon}"></i>${entry.name}
                                </a>` :
                                isLogFile ?
                                `<a href="#" onclick="handleFileClick('${LogService.buildViewUrl(path, entry.name)}', ${Object.values(servers).some(server => LogService.isFileSizeExceeding(entry[server.id]?.size, 10))}); return false;" class="${linkClass}">
                                    <i class="fas ${icon}"></i>${entry.name}
                                </a>` :
                                `<i class="fas ${icon}"></i>${entry.name}`
                            }
                        </div>
                    </td>
                    ${Object.entries(servers).map(([serverId, server]) => `
                        <td>
                            ${entry[serverId] ? `
                                <div class="server-info">
                                    <div class="date">${entry[serverId].date || '-'}</div>
                                    <div class="size ${LogService.isFileSizeExceeding(entry[serverId].size, 10) ? 'size-warning' : ''}">
                                        ${LogService.formatFileSize(entry[serverId].size)}
                                        ${LogService.isFileSizeExceeding(entry[serverId].size, 10) ? '<i class="fas fa-exclamation-triangle" title="Fichier > 10 Mo"></i>' : ''}
                                    </div>
                                    ${isDirectory ? '' : `
                                        <div class="direct-link">
                                            <a href="${LogService.buildRawUrl(serverId, path, entry.name)}" target="_blank">
                                            <i class="fas fa-external-link-alt"></i>
                                            </a>
                                        </div>
                                    `}
                                </div>
                            ` : `
                                <div class="server-info unavailable">
                                    <span>Non disponible</span>
                                </div>
                            `}
                        </td>
                    `).join('')}
                </tr>`;
            }
            html += `</tbody></table>

                <!-- Modal d'avertissement -->
                <div id="warningModal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h3>Fichier volumineux</h3>
                        </div>
                        <p>Ce fichier dépasse 10 Mo. Son chargement peut prendre un certain temps et impacter les performances.</p>
                        <p>Voulez-vous continuer ?</p>
                        <div class="modal-buttons">
                            <button class="modal-button cancel" onclick="closeModal()">Annuler</button>
                            <button class="modal-button proceed" onclick="proceedToView()">Continuer</button>
                        </div>
                    </div>
                </div>

                <script>
                    let pendingPath = '';
                    
                    function handleFileClick(path, isLargeFile) {
                        if (isLargeFile) {
                            pendingPath = path;
                            document.getElementById('warningModal').style.display = 'block';
                        } else {
                            window.location.href = path;
                        }
                    }
                    
                    function closeModal() {
                        document.getElementById('warningModal').style.display = 'none';
                        pendingPath = '';
                    }
                    
                    function proceedToView() {
                        if (pendingPath) {
                            window.location.href = '/view/' + pendingPath;
                        }
                    }
                    
                    // Fermer la modale si on clique en dehors
                    window.onclick = function(event) {
                        const modal = document.getElementById('warningModal');
                        if (event.target == modal) {
                            closeModal();
                        }
                    }
                </script>
            </body>
            </html>`;
            res.send(html);
    });

    return router;
};