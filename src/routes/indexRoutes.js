const express = require('express');
const router = express.Router();

module.exports = (servers, selectedserverKey) => {
    router.get('/', (req, res) => {
        const serverGroups = Object.entries(servers).map(([key, group]) => ({
            key,
            serverLabels: Object.values(group).map(srv => srv.label).join(', ')
        }));
        const selected = req.cookies?.serverKey || selectedserverKey;
        res.render('index', { serverGroups, selected });
    });

    return router;
};
