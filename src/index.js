require('dotenv').config();

const express = require('express');
const path = require('path');
const LogService = require('./services/LogService');
const config = require('./config');
const chalk = require('chalk').default; // Import chalk for colored output
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;

// Middleware pour parser le body des requêtes POST
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware to determine selected server group
app.use((req, res, next) => {
    // Priority: query > body > cookie > default
    let serverKey = req.query.serverKey
        || req.body?.serverKey
        || req.cookies?.serverKey
        || config.selectedserverKey;

    console.log(chalk.blue(`Selected serverKey: ${serverKey}`));

    // Save in cookie for persistence
    if (serverKey && req.cookies.serverKey !== serverKey) {
        res.cookie('serverKey', serverKey, { httpOnly: false });
    }

    req.selectedserverKey = serverKey;
    req.selectedServers = config.servers[serverKey] || {}
    req.logService = new LogService(req.selectedServers, config.credentials);
    next();
});

// Middleware de vérification des credentials
app.use((req, res, next) => {
    const missingCredentials = req.logService.getMissingCredentials();
    if (missingCredentials.length > 0 && !req.path.startsWith('/auth')) {
        return res.redirect('/auth/login');
    }
    next();
});

// Routes
// Pass req.selectedServers to routes
app.use('/auth', require('./routes/authRoutes')());
app.use('/path', require('./routes/pathRoutes')());
app.use('/view', require('./routes/viewRoutes')());
app.use('/api', require('./routes/apiRoutes')());
app.use('/', require('./routes/indexRoutes')(config.servers, config.selectedserverKey));


app.listen(port, () => {
    console.log(chalk.green(`Serveur démarré sur ${chalk.underline(`http://localhost:${port}`)}`));
});