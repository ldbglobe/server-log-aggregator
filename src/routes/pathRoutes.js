const express = require('express');
const router = express.Router();
const LogService = require('../services/LogService');
const config = require('../config');

module.exports = () => {
    router.get('/:serverGroup/*', async (req, res) => {
        const serverKey = req.params.serverGroup;
        const servers = req.selectedServers;
        const logService = req.logService;
        const path = req.params[0] || '';
        const data = await logService.aggregateLogs(path);
        const largeFileSizeThreshold = 5;
        const breadcrumbs = LogService.buildBreadcrumbs(path).map(link => ({
            name: link.name,
            url: LogService.buildPathUrl(link.path, '', serverKey),
            isLast: link.isLast
        }));
        const serverHeaders = Object.entries(servers).map(([id, server]) => server.label);
        const apiUrl = `/api/path/${serverKey}/${LogService.normalizePath(path)}`;
        const rootUrl = LogService.buildPathUrl('', '', serverKey);
        // Préparation des lignes du tableau
        const entries = data.map(entry => {
            const isSync = Object.keys(servers).every(serverId => entry[serverId]);
            const rowClass = isSync ? 'sync' : 'diff';
            const isDirectory = entry.isDirectory;
            const isLogFile = entry.isLogFileType;
            const isArchive = entry.isArchiveFile;
            const haveLargeFile = isLogFile && Object.entries(servers).some(([serverId, server]) => LogService.isFileSizeExceeding(entry[serverId]?.size, largeFileSizeThreshold));
            let icon;
            if (isDirectory) icon = 'fa-folder';
            else if (isArchive) icon = 'fa-file-zipper';
            else if (isLogFile) icon = 'fa-file-lines';
            else icon = 'fa-file';
            const linkClass = isDirectory ? 'folder-link' : 'file-link';
            let nameCellContent;
            if (isDirectory) {
                nameCellContent = `<a href="${LogService.buildPathUrl(path, entry.name, serverKey)}" class="${linkClass}"><i class="fas ${icon}"></i>${entry.name}</a>`;
            } else if (isLogFile) {
                nameCellContent = `<a href="#" onclick="handleFileClick('${LogService.buildViewUrl(path, entry.name, serverKey)}', ${haveLargeFile})" class="${linkClass}"><i class="fas ${icon}"></i>${entry.name}</a>`;
            } else {
                nameCellContent = `<i class="fas ${icon}"></i>${entry.name}`;
            }
            // Colonnes serveurs
            const serverCells = Object.entries(servers).map(([serverId, server]) => {
                let directLinkHtml = '';
                if (!isDirectory) {
                    directLinkHtml = `<div class="direct-link"><a href="${LogService.buildRawUrl(serverId, path, entry.name, serverKey)}" target="_blank"><i class="fas fa-external-link-alt"></i></a></div>`;
                }
                let isLargeFile = entry[serverId] && LogService.isFileSizeExceeding(entry[serverId].size, largeFileSizeThreshold);
                let sizeText = entry[serverId] ? LogService.formatFileSize(entry[serverId].size) : '-';
                let sizeClass = isLargeFile ? 'size-warning' : '';
                let sizeWarningIcon = isLargeFile ? `<i class="fas fa-exclamation-triangle" title="File > ${largeFileSizeThreshold} MB"></i>` : '';
                if (entry[serverId]) {
                    return `<div class="server-info"><div class="date">${entry[serverId].date || '-'}</div><div class="size ${sizeClass}">${sizeText} ${sizeWarningIcon}</div>${directLinkHtml}</div>`;
                } else {
                    return `<div class="server-info unavailable"><span>Unavailable</span></div>`;
                }
            });
            return { rowClass, nameCellContent, serverCells };
        });
        res.render('path', {
            serverKey,
            rootUrl,
            apiUrl,
            breadcrumbs,
            serverHeaders,
            entries,
            largeFileSizeThreshold
        });
    });

    return router;
};