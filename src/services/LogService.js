const axios = require('axios');
const cheerio = require('cheerio');
const zlib = require('zlib');
const { promisify } = require('util');

const gunzip = promisify(zlib.gunzip);

class LogService {
    constructor(servers,credentials) {
        this.servers = servers;
        this.credentials = credentials || {};
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
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt',
            // Images
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.ico',
            // Autres formats
            '.xml', '.json', '.csv', '.html', '.htm', '.css', '.js',
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

    static buildPathUrl(basePath='', itemPath='') {
        const normalizedBase = this.normalizePath(basePath);
        const normalizedItem = this.normalizePath(itemPath);
        let url = '/path/' + normalizedBase + normalizedItem;
        return url;
    }

    static buildViewUrl(basePath, itemPath) {
        const normalizedBase = this.normalizePath(basePath);
        const normalizedItem = this.normalizePath(itemPath);
        let url = '/view/' + normalizedBase + normalizedItem;
        return url;
    }

    static buildRawUrl(serverId, basePath, itemPath) {
        const normalizedBase = this.normalizePath(basePath);
        const normalizedItem = this.normalizePath(itemPath);
        let url = `/api/raw/${serverId}/${normalizedBase}${normalizedItem}`;
        return url;
    }

    static buildBreadcrumbs(path) {
        if (!path) return [];
        
        const parts = this.normalizePath(path).split('/').filter(Boolean);
        return parts.map((part, index) => {
            const currentPath = parts.slice(0, index + 1).join('/');
            const isLast = index === parts.length - 1;
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

    getMissingCredentials() {
        const requiredCredentialIds = new Set();
        Object.values(this.servers).forEach(server => {
            if (server.credentialId) {
                requiredCredentialIds.add(server.credentialId);
            }
        });
        const missingCredentials = [];
        requiredCredentialIds.forEach(credentialId => {
            if (!this.credentials[credentialId] || !this.credentials[credentialId].username || !this.credentials[credentialId].password) {
                missingCredentials.push(credentialId);
            }
        });

        return missingCredentials;
    }

    setCredentials(credentials) {
        this.credentials = { ...this.credentials, ...credentials };
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

        const credential = this.credentials[server.credentialId];
        if (!credential || !credential.username || !credential.password) {
            throw new Error(`Credentials manquants pour le serveur ${server.label}`);
        }

        const normalizedPath = LogService.normalizePath(path);
        const fullUrl = server.url.replace(/\/$/, '') + '/' + normalizedPath;
        console.log(`[DEBUG] makeRequest - URL appelée pour ${server.label}: ${fullUrl}`);

        const defaultOptions = {
            auth: {
                username: credential.username,
                password: credential.password
            }
        };
        console.log(`[DEBUG] makeRequest - Options: ${JSON.stringify(defaultOptions)}`);

        const requestOptions = {
            ...defaultOptions,
            ...options
        };

        try {
            const response = await axios.get(fullUrl, requestOptions);
            return response;
        } catch (error) {
            console.error(`[DEBUG] makeRequest - Erreur pour ${server.label}:`, error.message);
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
        const timestampRegex = /(?:\[)?(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d{3})?)?)(?:\])?/;
        const match = line.trim().match(timestampRegex);
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
        console.log(`[DEBUG] fetchFileContent - Chemin original: ${path}`);
        console.log(`[DEBUG] fetchFileContent - Chemin normalisé: ${normalizedPath}`);

        // Essayer de récupérer les logs de chaque serveur
        for (const [serverId, server] of Object.entries(this.servers)) {
            try {
                const response = await this.makeRequest(serverId, normalizedPath, {
                    responseType: 'arraybuffer'
                });
                
                let content;
                if (normalizedPath.endsWith('.gz')) {
                    console.log(`[DEBUG] fetchFileContent - Décompression du fichier .gz pour ${server.label}`);
                    content = (await gunzip(response.data)).toString('utf-8');
                } else {
                    content = response.data.toString('utf-8');
                }

                if (content) {
                    console.log(`[DEBUG] fetchFileContent - Contenu récupéré avec succès pour ${server.label} (${content.length} caractères)`);
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

        return allLogs.sort((a, b) => a.server===b.server ? 0 : a.timestamp - b.timestamp);
    }

    parseAndSortLogs(content, server, label, color) {
        const lines = content.split('\n');
        const logs = [];
        let currentLog = null;
        let lineNumber = 1;

        for (const line of lines) {
            const timestamp = this.extractTimestamp(line);

            if (!line.trim()) {
                lineNumber++;
                continue;
            }

            // Regex pour extraire le timestamp dans les différents formats
            
            
            if (timestamp) {
                if (currentLog) {
                    logs.push(currentLog);
                }
                
                currentLog = {
                    timestamp,
                    content: line,
                    server,
                    label,
                    color,
                    lineNumber,
                    additionalLines: []
                };
            } else if (currentLog) {
                currentLog.additionalLines.push({
                    content: line,
                    lineNumber
                });
            }
            lineNumber++;
        }

        if (currentLog) {
            logs.push(currentLog);
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

        console.log(`[DEBUG] fetchRawLog - URL appelée pour ${server.label}: ${fullUrl}`);

        const credential = this.credentials[server.credentialId];
        if (!credential || !credential.username || !credential.password) {
            throw new Error(`Credentials manquants pour le serveur ${server.label}`);
        }

        const requestOptions = {
            auth: {
                username: credential.username,
                password: credential.password
            },
            responseType: 'arraybuffer'
        };

        try {
            const response = await axios.get(fullUrl, {
                ...requestOptions,
                responseType: 'stream'
            });
            const stream = response.data; // This is a readable stream

            if (normalizedPath.endsWith('.gz')) {
                console.log(`[DEBUG] fetchRawLog - Décompression du fichier .gz pour ${server.label}`);
                return stream.pipe(zlib.createGunzip());
            }

            console.log(`[DEBUG] fetchRawLog - Contenu brut récupéré avec succès pour ${server.label}`);
            return stream;
        } catch (error) {
            console.error(`[DEBUG] fetchRawLog - Erreur pour ${server.label}:`, error.message);
            throw error;
        }
    }
}

module.exports = LogService;