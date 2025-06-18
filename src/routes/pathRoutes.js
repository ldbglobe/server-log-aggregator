const express = require('express');
const router = express.Router();
const LogService = require('../services/LogService');

const largeFileSizeThreshold = 5; // MB

module.exports = () => {
    router.get('/*', async (req, res) => {
        const servers = req.selectedServers;
        const serverKey = req.selectedserverKey;
        const logService = req.logService;
        const path = req.params[0] || '';
        const data = await logService.aggregateLogs(path);

        console.log(`PathRoutes initialized for serverKey: ${serverKey}`);
        
        // Build breadcrumbs
        const breadcrumbs = LogService.buildBreadcrumbs(path);
        
        let html = `
            <html>
            <head>
                <title>Logs Comparison</title>
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
                        <a href="${LogService.buildPathUrl()}"><i class="fas fa-home"></i>Root</a>
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
                            <th>Name</th>
                            ${Object.entries(servers).map(([id, server]) => `
                                <th>${server.label}</th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
            `;

            for (const entry of data) {
                // Check if all servers have the file
                const isSync = Object.keys(servers).every(serverId => entry[serverId]);
                const rowClass = isSync ? 'sync' : 'diff';
                
                const isDirectory = entry.isDirectory;
                const isLogFile = entry.isLogFileType;
                const isArchive = entry.isArchiveFile;
                const haveLargeFile = isLogFile && Object.entries(servers).some(([serverId, server]) => LogService.isFileSizeExceeding(entry[serverId]?.size, largeFileSizeThreshold));
                
                let icon;
                if (isDirectory) {
                    icon = 'fa-folder';
                } else if (isArchive) {
                    icon = 'fa-file-zipper';
                } else if (isLogFile) {
                    icon = 'fa-file-lines';
                } else {
                    icon = 'fa-file';
                }
                const linkClass = isDirectory ? 'folder-link' : 'file-link';
                const linkPath = LogService.buildPathUrl(path, entry.name);
                
                let nameCellContent;
                if (isDirectory) {
                    nameCellContent = `<a href="${linkPath}" class="${linkClass}">
                        <i class="fas ${icon}"></i>${entry.name}
                    </a>`;
                } else if (isLogFile) {
                    nameCellContent = `<a href="#" onclick="handleFileClick('${linkPath}', ${haveLargeFile}); return false;" class="${linkClass}">
                        <i class="fas ${icon}"></i>${entry.name}
                    </a>`;
                } else {
                    nameCellContent = `<i class="fas ${icon}"></i>${entry.name}`;
                }

                html += `<tr class="${rowClass}">
                    <td class="mono">
                        <div class="link-container">
                            ${nameCellContent}
                        </div>
                    </td>
                    ${Object.entries(servers).map(([serverId, server]) => {
                        let directLinkHtml = '';
                        if (!isDirectory) {
                            directLinkHtml = `
                                <div class="direct-link">
                                    <a href="${LogService.buildRawUrl(serverId, path, entry.name)}" target="_blank">
                                    <i class="fas fa-external-link-alt"></i>
                                    </a>
                                </div>
                            `;
                        }
                        let isLargeFile = entry[serverId] && LogService.isFileSizeExceeding(entry[serverId].size, largeFileSizeThreshold);

                        let sizeText = entry[serverId] ? LogService.formatFileSize(entry[serverId].size) : '-';
                        let sizeClass = isLargeFile ? 'size-warning' : '';
                        let sizeWarningIcon = isLargeFile ? `<i class="fas fa-exclamation-triangle" title="File > ${largeFileSizeThreshold} MB"></i>` : '';

                        return `<td>
                            ${entry[serverId] ? `
                                <div class="server-info">
                                    <div class="date">${entry[serverId].date || '-'}</div>
                                    <div class="size ${sizeClass}">${sizeText} ${sizeWarningIcon}</div>
                                    ${directLinkHtml}
                                </div>
                            ` : `
                                <div class="server-info unavailable">
                                    <span>Unavailable</span>
                                </div>
                            `}
                        </td>`
                    }).join('')}
                </tr>`;
            }
            html += `</tbody></table>

                <!-- Warning modal -->
                <div id="warningModal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h3>Large file</h3>
                        </div>
                        <p>This file exceeds ${largeFileSizeThreshold} MB. Loading it may take some time and impact performance.</p>
                        <p>Do you want to continue?</p>
                        <div class="modal-buttons">
                            <button class="modal-button cancel" onclick="closeModal()">Cancel</button>
                            <button class="modal-button proceed" onclick="proceedToView()">Continue</button>
                        </div>
                    </div>
                </div>

                <script>
                    let pendingPath = '';
                    
                    function handleFileClick(path, isLargeFile) {
                        console.log('File clicked:', path, 'Large file:', isLargeFile);
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
                    
                    // Close modal if clicking outside
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