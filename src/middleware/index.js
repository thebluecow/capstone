
var auth = require('basic-auth');
var User = require('../models/user');

// Add a middleware function that attempts to get the user credentials from Authorization header set on the request
function validateUser(req, res, next) {
    // gets authorization header from request
    var credentials = auth.parse(req.get('Authorization'));

    if (credentials) {

        User.authenticate(credentials.name, credentials.pass, function(error, user) {
            if (error || !user) {
                var err = new Error('Wrong email or password.');
                err.status = 401;
                return next(err);
            } else {
                //req.session.userId = user._id;
                req.userId = user._id;
                return next();
            }
        });

    } else {
        var err = new Error('You must be logged in to view this document');
        err.status = 401;
        return next(err);
    }
}

module.exports.validateUser = validateUser;