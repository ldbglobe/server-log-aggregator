const express = require('express');
const router = express.Router();

module.exports = () => {
    // Route to display the login form
    router.get('/login', (req, res) => {
        const servers = req.selectedServers;
        const serverKey = req.selectedserverKey;
        const logService = req.logService;

        console.log(`AuthRoutes initialized for serverKey: ${serverKey}`);

        const missingCredentials = logService.getMissingCredentials();
        if (missingCredentials.length === 0) {
            return res.redirect('/');
        }

        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authentication - Server Log Aggregator</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background-color: #f5f5f5;
                    }
                    .login-container {
                        max-width: 600px;
                        margin: 40px auto;
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    h1 {
                        color: #333;
                        margin-bottom: 20px;
                    }
                    .credential-form {
                        margin-bottom: 30px;
                        padding: 20px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                    }
                    .credential-form h2 {
                        margin-top: 0;
                        color: #666;
                    }
                    .form-group {
                        margin-bottom: 15px;
                    }
                    label {
                        display: block;
                        margin-bottom: 5px;
                        color: #666;
                    }
                    input {
                        width: 100%;
                        padding: 8px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        box-sizing: border-box;
                    }
                    button {
                        background-color: #4299e1;
                        color: white;
                        padding: 10px 20px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    button:hover {
                        background-color: #3182ce;
                    }
                    .ldap-info {
                        background-color: #ebf8ff;
                        border: 1px solid #bee3f8;
                        border-radius: 4px;
                        padding: 10px;
                        margin-bottom: 15px;
                        color: #2c5282;
                        font-size: 0.9em;
                    }
                </style>
                <script>
                    // Load saved credentials from localStorage
                    window.addEventListener('load', function() {
                        ${missingCredentials.map(credentialId => `
                            const savedCreds_${credentialId} = localStorage.getItem('credentials_${credentialId}');
                            if (savedCreds_${credentialId}) {
                                const creds = JSON.parse(savedCreds_${credentialId});
                                document.getElementById('username_${credentialId}').value = creds.username;
                                document.getElementById('password_${credentialId}').value = creds.password;
                            }
                        `).join('')}
                    });

                    // Save credentials to localStorage before form submission
                    function saveCredentials() {
                        ${missingCredentials.map(credentialId => `
                            const username_${credentialId} = document.getElementById('username_${credentialId}').value;
                            const password_${credentialId} = document.getElementById('password_${credentialId}').value;
                            localStorage.setItem('credentials_${credentialId}', JSON.stringify({
                                username: username_${credentialId},
                                password: password_${credentialId}
                            }));
                        `).join('')}
                    }
                </script>
            </head>
            <body>
                <div class="login-container">
                    <h1>Authentication required</h1>
                    <form action="/auth/login" method="POST" onsubmit="saveCredentials()">
                        ${missingCredentials.map(credentialId => `
                            <div class="credential-form">
                                <div class="ldap-info">
                                    <i class="fas fa-info-circle"></i>
                                    Please enter your LDAP credentials to access the server
                                </div>
                                <h2>Credentials for ${credentialId}</h2>
                                <div class="form-group">
                                    <label for="username_${credentialId}">LDAP Username</label>
                                    <input type="text" id="username_${credentialId}" name="credentials[${credentialId}][username]" required>
                                </div>
                                <div class="form-group">
                                    <label for="password_${credentialId}">LDAP Password</label>
                                    <input type="password" id="password_${credentialId}" name="credentials[${credentialId}][password]" required>
                                </div>
                            </div>
                        `).join('')}
                        <button type="submit">Log in</button>
                    </form>
                </div>
            </body>
            </html>
        `;
        res.send(html);
    });

    // Route to process the login form
    router.post('/login', (req, res) => {
        const credentials = req.body.credentials;
        req.logService.setCredentials(credentials);
        res.redirect('/');
    });

    return router;
};