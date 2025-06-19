const express = require('express');
const router = express.Router();

module.exports = () => {
    // Route to display the login form
    router.get('/login', (req, res) => {
        const logService = req.logService;
        const missingCredentials = logService.getMissingCredentials();
        if (missingCredentials.length === 0) {
            return res.redirect('/');
        }
        res.render('login', { missingCredentials });
    });

    // Route to process the login form
    router.post('/login', (req, res) => {
        const credentials = req.body.credentials;
        req.logService.setCredentials(credentials);
        res.redirect('/');
    });

    return router;
};