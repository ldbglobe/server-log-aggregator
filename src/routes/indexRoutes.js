const express = require('express');
const router = express.Router();

module.exports = (servers) => {
    router.get('/', (req, res) => {
        const serverGroups = Object.entries(servers).map(([key, group]) => ({
            key,
            serverLabels: Object.values(group).map(srv => srv.label).join(', '),
            url: `/path/${key}/` // Génère le lien avec le group dans l'URL
        }));
        res.render('index', { serverGroups });
    });

    return router;
};
