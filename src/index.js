const express = require('express');
const path = require('path');
const LogService = require('./services/LogService');
config = require('./config');
const chalk = require('chalk').default; // Import chalk for colored output

const app = express();
const port = process.env.PORT || 3000;

// Middleware pour parser le body des requêtes POST
app.use(express.urlencoded({ extended: true }));

// Initialiser le service de logs
const logService = new LogService();

// Middleware de vérification des credentials
app.use((req, res, next) => {
    const missingCredentials = logService.getMissingCredentials();
    if (missingCredentials.length > 0 && !req.path.startsWith('/auth')) {
        return res.redirect('/auth/login');
    }
    next();
});

// Routes
app.use('/auth', require('./routes/authRoutes')(logService));
app.use('/path', require('./routes/pathRoutes')(logService, config.servers));
app.use('/view', require('./routes/viewRoutes')(logService, config.servers));
app.use('/api', require('./routes/apiRoutes')(logService));

// Redirection de la racine vers /path
app.get('/', (req, res) => {
    res.redirect('/path');
});

app.listen(port, () => {
    console.log(chalk.green(`Serveur démarré sur ${chalk.underline(`http://localhost:${port}`)}`));
}); 