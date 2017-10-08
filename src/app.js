
var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var path = require('path');
var fs = require('fs');
var session = require('express-session');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var passport = require('passport');
//var localStrategy = require('passport-local').Strategy;
var PassportLocalStrategy = require('passport-local')
//var flash = require('connect-flash'); 

// seed the database
var seeder = require('mongoose-seeder');
var data = require('./data/seed.json');
var Action = require('./models/action.js');
var User = require('./models/user');
var Deck = require('./models/deck');
var Match = require('./models/match');

var app = express();
// set mongodb database name
const DB_NAME = 'ijw';
var port = process.env.PORT || 3000;

require('./config/passport.js')(passport);

// parse incoming requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());
app.use(require('express-session')({
    secret: 'yo joe',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// serve static files from /public
app.use('/', express.static('public'));

// routes
var actionRouter = require('./api/index.js');
app.use('/api/', actionRouter);
app.use('/user/', actionRouter);

// connect to local mongodb
mongoose.connect('mongodb://localhost:27017/' + DB_NAME);

var db = mongoose.connection;

db.on('error', function(err) {
    console.error('connection error:', err);
});

db.once('open', function() {
    console.log('db connection successful');

    // adding drop database here to ensure unique index on email
    // is properly created
    db.dropDatabase(function(err, result) {
        console.log('db dropped');
    });

    // once the connection has been established, seed the database
    seeder.seed(data, {
        dropDatabase: true
    }).then(function(db) {
        console.log('the database has been seeded with data.');
    }).catch(function(err) {
        console.error(err);
    });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('File Not Found');
    err.status = 404;
    next(err);
});

// error handler
// define as the last app.use callback
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    /* res.render('error', {
       message: err.message,
       error: {}
     });*/
    res.json({
        error: {
            message: err.message
        }
    });
});

// listen on port 3000
app.listen(port, function() {
    console.log('Express app listening on port ' + port);
});