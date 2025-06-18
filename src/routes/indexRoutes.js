const express = require('express');
const router = express.Router();

module.exports = (servers, selectedserverKey) => {
    router.get('/', (req, res) => {
        const serverGroups = Object.entries(servers);
        // Get selected from cookie if present, else use default
        const selected = req.cookies?.serverKey || selectedserverKey;
        res.send(`
            <html>
            <head>
                <title>Choix du groupe de serveurs</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 2em; }
                    .card-container {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 1.5em;
                        justify-content: flex-start;
                    }
                    .server-card {
                        flex: 0 1 320px;
                        background: #f7fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 10px;
                        padding: 1.5em 1.2em;
                        box-shadow: 0 2px 8px rgba(66,153,225,0.07);
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                        transition: box-shadow 0.2s, border 0.2s;
                        position: relative;
                    }
                    .server-card.selected {
                        border: 2px solid #2ecc40;
                        box-shadow: 0 4px 16px rgba(46,204,64,0.13);
                        background: #e6fffa;
                    }
                    .server-card .server-group-label {
                        font-weight: bold;
                        font-size: 1.3em;
                        margin-bottom: 0.5em;
                        color: #2c5282;
                    }
                    .server-card .server-list {
                        margin-bottom: 1em;
                        color: #4a5568;
                        font-size: 1em;
                    }
                    .server-card button {
                        align-self: flex-end;
                        padding: 0.5em 1.2em;
                        border: none;
                        border-radius: 4px;
                        background: #4299e1;
                        color: white;
                        font-weight: bold;
                        cursor: pointer;
                        transition: background 0.2s;
                        font-size: 1em;
                    }
                    .server-card button.selected {
                        background: rgb(43, 176, 94);
                    }
                </style>
            </head>
            <body>
                <h2>Choisissez un groupe de serveurs</h2>
                <div class="card-container">
                    ${serverGroups.map(([key, group]) => `
                        <div class="server-card" id="card-${key}" data-key="${key}">
                            <div class="server-group-label">${key}</div>
                            <div class="server-list">
                                ${Object.values(group).map(srv => srv.label).join(', ')}
                            </div>
                            <button onclick="selectGroup('${key}')" id="btn-${key}">Consulter</button>
                        </div>
                    `).join('')}
                </div>
                <script>
                    function setCookie(name, value, days) {
                        let expires = "";
                        if (days) {
                            const date = new Date();
                            date.setTime(date.getTime() + (days*24*60*60*1000));
                            expires = "; expires=" + date.toUTCString();
                        }
                        document.cookie = name + "=" + (value || "")  + expires + "; path=/";
                    }
                    function getCookie(name) {
                        const value = "; " + document.cookie;
                        const parts = value.split("; " + name + "=");
                        if (parts.length === 2) return parts.pop().split(";").shift();
                    }
                    function selectGroup(key) {
                        setCookie('serverKey', key, 365);
                        document.querySelectorAll('.server-card').forEach(card => card.classList.remove('selected'));
                        document.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
                        document.getElementById('card-' + key).classList.add('selected');
                        document.getElementById('btn-' + key).classList.add('selected');
                        setTimeout(() => { window.location.href = '/path'; }, 500);
                    }
                    // Highlight selected on load
                    const selected = getCookie('serverKey') || '${selected}';
                    if (selected) {
                        const card = document.getElementById('card-' + selected);
                        const btn = document.getElementById('btn-' + selected);
                        if (card) card.classList.add('selected');
                        if (btn) btn.classList.add('selected');
                    }
                </script>
            </body>
            </html>
        `);
    });

    return router;
};
