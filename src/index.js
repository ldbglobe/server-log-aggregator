require('dotenv').config();

const express = require('express');
const path = require('path');
const expressHandlebars = require('express-handlebars');
const LogService = require('./services/LogService');
const config = require('./config');
const chalk = require('chalk').default; // Import chalk for colored output
const cookieParser = require('cookie-parser');
const openurl = require('openurl');

const app = express();
const port = process.env.PORT || 3000;

// Handlebars view engine setup
app.engine('hbs', expressHandlebars.engine({ extname: '.hbs', defaultLayout: false }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '../views'));

// Middleware to parse the body of POST requests
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

// Middleware to check credentials
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

// You cannot directly detect browser close from the server side.
// To gracefully handle server shutdown (e.g., on CTRL+C), use:
process.on('SIGINT', () => {
    console.log(chalk.red('\nServer shutting down...'));
    process.exit();
});

app.listen(port, () => {
    // Log the server start message with colored output
    console.log(chalk.green(`Server started at ${chalk.underline(`http://localhost:${port}`)}`));
    // Press CTRL+C to stop the server
    console.log(chalk.yellow('Press CTRL+C to stop the server.'));
    openurl.open(`http://localhost:${port}`);
});

