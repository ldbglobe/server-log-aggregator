const axios = require('axios');
const cheerio = require('cheerio');
const zlib = require('zlib');
const { promisify } = require('util');
const crypto = require('crypto');

const gunzip = promisify(zlib.gunzip);

class LogService {
    constructor(servers) {
        this.servers = servers;
    }

    // Méthodes de FileUtils
    static formatFileSize(bytes) {
        if (!bytes) return '-';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    static isFileSizeExceeding(size, maxSizeMB) {
        if (!size) return false;
        return size > maxSizeMB * 1024 * 1024;
    }

    static isArchiveFile(filename) {
        if (!filename) return false;
        const archiveExtensions = ['.gz'];
        return archiveExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }

    static isBinaryOrNonLogFile(filename) {
        if (!filename) return false;
        const nonLogExtensions = [
            // Documents
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt',
            '.pptx', '.txt', '.md', '.rtf', '.odt', '.csv',
            // Images
            '.jpg', '.jpeg', '.png', '.gif', '.bmp',
            '.svg', '.ico', '.tiff', '.webp',
            // Compressed files
            '.zip', '.tar', '.tar.gz', '.rar', '.7z', '.tgz',
            // Audio/Video
            '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma',
            '.avi', '.mpg', '.mpeg', '.mov', '.wmv', '.flv', '.webm',
            // Code files
            '.c', '.cpp', '.h', '.hpp', '.py', '.java', '.php', '.rb',
            '.go', '.rs', '.ts', '.tsx', '.html', '.htm', '.xml',
            '.json', '.yaml', '.yml', '.css', '.js',
            // Exécutables
            '.exe', '.dll', '.so', '.dylib', '.bin'
        ];
        return nonLogExtensions.some(ext => filename.replace(/\.gz$/,'').toLowerCase().endsWith(ext));
    }

    static isLogFileType(filename) {
        if (!filename) return false;
        if (this.isBinaryOrNonLogFile(filename)) return false;
        const logExtensions = ['.log', '.raw', '.gz'];
        return logExtensions.some(ext => filename.toLowerCase().replace(/\.[\d-]+$/,'').endsWith(ext));
    }

    static normalizePath(pathStr) {
        if (!pathStr) return '';
        
        // Supprime les segments 'view' et 'path' du début du chemin
        let normalized = pathStr.replace(/^\/?(view|path)\//, '');
        
        // Supprime les slashes au début
        normalized = normalized.replace(/^\/+/g, '');
        
        // Supprime les slashes multiples entre les segments
        normalized = normalized.replace(/\/+/g, '/');
        
        return normalized;
    }

    static buildPathUrl(basePath='', itemPath='', serverGroup='') {
        const normalizedBase = this.normalizePath(basePath);
        const normalizedItem = this.normalizePath(itemPath);
        // -- console.log(`[DEBUG] buildPathUrl - Base: ${normalizedBase}, Item: ${normalizedItem}, ServerGroup: ${serverGroup}`);
        let url = '/path/';
        if (serverGroup) url += serverGroup + '/';
        url += normalizedBase + normalizedItem;
        return url;
    }

    static buildViewUrl(basePath, itemPath, serverGroup='') {
        const normalizedBase = this.normalizePath(basePath);
        const normalizedItem = this.normalizePath(itemPath);
        let url = '/view/';
        if (serverGroup) url += serverGroup + '/';
        url += normalizedBase + normalizedItem;
        return url;
    }

    static buildRawUrl(serverId, basePath, itemPath, serverGroup='') {
        const normalizedBase = this.normalizePath(basePath);
        const normalizedItem = this.normalizePath(itemPath);
        let url = `/api/`;
        if (serverGroup) url += serverGroup + '/raw/';
        url += `${serverId}/` + normalizedBase + normalizedItem;
        return url;
    }

    static buildBreadcrumbs(path) {
        if (!path) return [];
        
        const parts = this.normalizePath(path).split('/').filter(Boolean);
        return parts.map((part, index) => {
            const currentPath = parts.slice(0, index + 1).join('/');
            const isLast = index === parts.length - 1;
            // -- console.log(`[DEBUG] buildBreadcrumbs - Part: ${part}, Current Path: ${currentPath}, Is Last: ${isLast}`);
            return {
                name: part,
                path: currentPath + (isLast ? '' : '/'),
                isLast: isLast
            };
        });
    }

    static sensitivePatterns = [
        /password\s*[:=]\s*["']?[\w@#$%^&*]+["']?/i, // Passwords
        /api[_-]?key\s*[:=]\s*["']?[\w-]+["']?/i,    // API keys
        /Bearer\s+[\w-]+/i,                         // Bearer tokens
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i // Email addresses
    ];

    scanForSensitiveData(logs) {
        const matches = [];
        logs.flatMap(logLine => {
            const content = (logLine.content || '') + (logLine.additionalLines || []).map(line => line.content).join('\n');
            if (!content) return matches;
            LogService.sensitivePatterns.forEach((pattern) => {
                const match = logLine.content.match(pattern);
                if (match) {
                    matches.push({
                        ...logLine,
                        sensitiveData: match[0]
                    });
                }
            });
        })
        return matches;
    }

    parseNginxIndex(html) {
        const $ = cheerio.load(html);
        const items = [];
        $('pre').contents().each((i, el) => {
            if (el.type === 'text') return;
            if (el.name !== 'a') return;
            const name = $(el).text();
            const href = $(el).attr('href');
            const after = el.nextSibling && el.nextSibling.nodeValue
                ? el.nextSibling.nodeValue.trim()
                : '';
            const match = after.match(/(\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2})\s+(-|\d+)/);
            let date = null, size = null;
            if (match) {
                date = match[1];
                size = match[2] === '-' ? null : parseInt(match[2], 10);
            }
            items.push({
                name,
                href,
                date,
                size
            });
        });
        return items;
    }

    async makeRequest(serverId, path, options = {}) {
        const server = this.servers[serverId];
        if (!server) {
            throw new Error(`Serveur non configuré: ${serverId}`);
        }

        const normalizedPath = LogService.normalizePath(path);
        const fullUrl = server.url.replace(/\/$/, '') + '/' + normalizedPath;
        // -- console.log(`[DEBUG] makeRequest - URL appelée pour ${server.label}: ${fullUrl}`);

        const defaultOptions = {
            auth: { ...server.auth }
        };
        // -- console.log(`[DEBUG] makeRequest - Options: ${JSON.stringify(defaultOptions)}`);

        const requestOptions = {
            ...defaultOptions,
            ...options
        };

        try {
            const response = await axios.get(fullUrl, requestOptions);
            return response;
        } catch (error) {
            // -- console.error(`[DEBUG] makeRequest - Erreur pour ${server.label}:`, error.message);
            if (error.response) {
                console.error('[DEBUG] makeRequest - Status:', error.response.status);
                console.error('[DEBUG] makeRequest - Headers:', error.response.headers);
            }
            throw error;
        }
    }

    async fetchLogs(serverId, path = '') {
        try {
            const server = this.servers[serverId];
            if (!server) {
                throw new Error(`Serveur non configuré: ${serverId}`);
            }

            const response = await this.makeRequest(serverId, path);
            const logs = this.parseNginxIndex(response.data);
            
            return {
                server: serverId,
                label: server.label,
                color: server.color,
                logs
            };
        } catch (error) {
            console.error(`Erreur lors de la récupération des logs du serveur ${serverId}:`, error.message);
            return {
                server: serverId,
                label: this.servers[serverId]?.label || serverId,
                color: this.servers[serverId]?.color || '#000000',
                logs: null
            };
        }
    }

    async aggregateLogs(path = '') {
        const serverLogs = await Promise.all(
            Object.entries(this.servers).map(([serverId]) => 
                this.fetchLogs(serverId, path)
            )
        );

        const allNames = new Set();
        serverLogs.forEach(({ logs }) => {
            if (logs) {
                logs.forEach(item => allNames.add(item.name));
            }
        });

        const result = [];
        for (const name of allNames) {
            // Skip '../' entry on server root
            if (name === '../' && path === '') {
                continue;
            }
            
            // Trouver le premier serveur qui a ce fichier pour récupérer l'href
            const firstServerWithFile = serverLogs.find(({ logs }) => 
                logs && logs.find(i => i.name === name)
            );
            
            const entry = { 
                name,
                isDirectory: name.endsWith('/'),
                isArchiveFile: LogService.isArchiveFile(name),
                isLogFileType: LogService.isLogFileType(name)
            };

            serverLogs.forEach(({ server, logs }) => {
                if (logs) {
                    const logEntry = logs.find(i => i.name === name);
                    if (logEntry) {
                        // On ne garde que les informations spécifiques au fichier et au serveur
                        const { name: _, href: __, isDirectory: ___, ...fileInfo } = logEntry;
                        entry[server] = fileInfo;
                    }
                }
            });
            result.push(entry);
        }
        result.sort((a, b) => a.name.localeCompare(b.name));
        result.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory)); // Dossiers en premier
        return result;
    }

    extractTimestamp(line) {
        // [2025-05-27T03:00:02.638] 
        // [2025-05-27T03:00:02] 
        // [2025-05-27] 
        // [2025-05-27 03:00:02.638] 
        // [2025-05-27 03:00:02] 
        // 2025-05-27T03:00:02.638
        // 2025-05-27T03:00:02
        // 2025-05-27
        // 2025-05-27 03:00:02.638
        // 2025-05-27 03:00:02 
        const dateRegex = [
            // ISO
            /^[^{]+(?:\[)?(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d{3})?)?)(?:\])?/,
            // DATALAKE TRANSACTION OBJECT
            /"receivedAt":"(?:\[)?(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d{3})?)?)(?:\])?.","storeId"/
        ]
        let match = null;
        for(let i in dateRegex){
            let regex = dateRegex[i];
            match = line.trim().match(regex);
            if (match) {
                break;
            }
        }

        if (match) {
            const [_, timestamp] = match;
            // Normalize the timestamp to a proper ISO 8601 format
            const normalizedTimestamp = timestamp.replace(' ', 'T');
            const parsedDate = Date.parse(normalizedTimestamp);
            if (!isNaN(parsedDate)) {
                return new Date(parsedDate);
            }
        }
        return null;
    }

    async fetchFileContent(path) {
        const results = [];
        const normalizedPath = LogService.normalizePath(path);
        // -- console.log(`[DEBUG] fetchFileContent - Chemin original: ${path}`);
        // -- console.log(`[DEBUG] fetchFileContent - Chemin normalisé: ${normalizedPath}`);

        // Essayer de récupérer les logs de chaque serveur
        for (const [serverId, server] of Object.entries(this.servers)) {
            try {
                const response = await this.makeRequest(serverId, normalizedPath, {
                    responseType: 'arraybuffer'
                });
                
                let content;
                if (normalizedPath.endsWith('.gz')) {
                    // -- console.log(`[DEBUG] fetchFileContent - Décompression du fichier .gz pour ${server.label}`);
                    content = (await gunzip(response.data)).toString('utf-8');
                } else {
                    content = response.data.toString('utf-8');
                }

                if (content) {
                    // -- console.log(`[DEBUG] fetchFileContent - Contenu récupéré avec succès pour ${server.label} (${content.length} caractères)`);
                    results.push({
                        content,
                        server: serverId,
                        label: server.label,
                        color: server.color
                    });
                }
            } catch (error) {
                console.error(`[DEBUG] fetchFileContent - Erreur pour ${server.label}:`, error.message);
            }
        }

        if (results.length === 0) {
            throw new Error('Impossible de récupérer les logs depuis aucun serveur');
        }

        // Fusionner et trier les logs
        const allLogs = results.flatMap(result => 
            this.parseAndSortLogs(result.content, result.server, result.label, result.color)
        );

        const dedupedLogs = [];
        const seenHashes = new Map();

        for (const log of allLogs) {
            const hash = this.__buildHash(log);
            if (!seenHashes.has(hash)) {
            seenHashes.set(hash, log);
            dedupedLogs.push(log);
            } else {
            // Merge servers arrays (avoid duplicates)
            const existingLog = seenHashes.get(hash);
            existingLog.servers = Array.from(new Set([...(existingLog.servers || []), ...(log.servers || [])]));
            }
        }
        // -- console.log(`[DEBUG] fetchFileContent - Nombre total de logs récupérés: ${dedupedLogs.length}`);

        // Tri global par timestamp (nulls à la fin)
        return dedupedLogs.sort((a, b) => {
            if (!a.timestamp && !b.timestamp) return 0;
            if (!a.timestamp) return 1;
            if (!b.timestamp) return -1;
            return a.timestamp - b.timestamp;
        });
    }

    __buildHash(log) {
        const hashKey = log.lineNumber + '\n' + (log.timestamp ? log.timestamp.toISOString() : '') +'\n'+ log.content +'\n'+ log.additionalLines.map(l => l.content).join('\n');
        const hash = crypto.createHash('sha256')
            .update(hashKey)
            .digest('hex');
        return hash;
    }

    __addLogToList(logs, log) {
        logs.push({...log, hash: this.__buildHash(log)});
        return logs;
    }

    parseAndSortLogs(content, server, label, color) {
        const lines = content.split('\n');
        const logs = [];
        let currentLog = null;
        let lineNumber = 1;

        for (const line of lines) {
            let timestamp = this.extractTimestamp(line);

            if (!line.trim()) {
                lineNumber++;
                continue;
            }

            if(!currentLog && !timestamp) {
                this.__addLogToList(logs, {
                    timestamp: null,
                    content: line,
                    servers: [server],
                    label,
                    color,
                    lineNumber,
                    additionalLines: []
                });
            }                
            else if (timestamp) {
                if (currentLog) {
                    logs.push(currentLog);
                    this.__addLogToList(logs, currentLog);
                }
                
                currentLog = {
                    timestamp,
                    content: line,
                    servers: [server],
                    label,
                    color,
                    lineNumber,
                    additionalLines: []
                };
            } else if (currentLog) {
                // we just
                currentLog.additionalLines.push(line);
            }
            lineNumber++;
        }

        if (currentLog) {
            this.__addLogToList(logs, currentLog);
        }



        return logs;
    }

    async fetchRawLog(serverId, path) {
        const server = this.servers[serverId];
        if (!server) {
            throw new Error(`Serveur non configuré: ${serverId}`);
        }

        const normalizedPath = LogService.normalizePath(path);
        const fullUrl = server.url.replace(/\/$/, '') + '/' + normalizedPath;

        // -- console.log(`[DEBUG] fetchRawLog - URL appelée pour ${server.label}: ${fullUrl}`);

        const requestOptions = {
            auth: { ...server.auth },
            responseType: 'arraybuffer'
        };

        try {
            const response = await axios.get(fullUrl, requestOptions);
            let content;
            if (normalizedPath.endsWith('.gz')) {
                content = (await gunzip(response.data)).toString('utf-8');
            } else {
                content = response.data.toString('utf-8');
            }
            return content;
        } catch (error) {
            console.error(`[DEBUG] fetchRawLog - Erreur pour ${server.label}:`, error.message);
            throw error;
        }
    }
}

module.exports = LogService;