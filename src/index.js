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
const port = process.env.PORT || 41240;

// Handlebars view engine setup
app.engine('hbs', expressHandlebars.engine({ extname: '.hbs', defaultLayout: false }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse the body of POST requests
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware to determine selected server group
app.use((req, res, next) => {
    // Si l'URL contient un paramètre :serverGroup, on l'utilise
    const match = req.path.match(/^\/(path|view|api)(\/([^\/]+))/);
    let serverKey = null;
    if (match && match[3]) {
        serverKey = match[3];
    } else {
        // fallback: default
        serverKey = config.selectedserverKey;
    }
    req.selectedserverKey = serverKey;
    req.selectedServers = config.servers[serverKey] || {};
    req.logService = new LogService(req.selectedServers);
    next();
});

// Routes
// Pass req.selectedServers to routes
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
    if (process.env.NODE_ENV === 'development') {
        console.log(chalk.blue('Running in development mode.'));
    }
    else {
        console.log(chalk.blue('Running in production mode.'));
    }
    // Press CTRL+C to stop the server
    console.log(chalk.yellow('Press CTRL+C to stop the server.'));
    openurl.open(`http://localhost:${port}`);
});

