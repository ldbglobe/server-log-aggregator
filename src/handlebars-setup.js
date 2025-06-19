const expressHandlebars = require('express-handlebars');
const express = require('express');
const path = require('path');
// ...existing code...

const app = express();
const port = process.env.PORT || 3000;

// Handlebars view engine setup
app.engine('hbs', expressHandlebars.engine({ extname: '.hbs', defaultLayout: false }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// ...existing code...
