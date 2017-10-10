'use strict';

var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var passportLocalMongoose = require('passport-local-mongoose');

var UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    photo: {
        type: String,
        required: false,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    champion: {
        type: String,
        required: false
    },
    roles: [{
        type: String,
        required: false
    }],
    achievements: [{
        type: String,
        required: false
    }],
    results: {
        wins: { 
            type: Number,
            default: 0
        },
        losses: { 
            type: Number,
            default: 0
        },
        draws: { 
            type: Number,
            default: 0
        }
    }
});

// https://stackoverflow.com/questions/18022365/mongoose-validate-email-syntax
UserSchema.path('email').validate(function(email) {
    var emailRegex = /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/;
    return emailRegex.test(this.email); // Assuming email has a text attribute
}, 'The e-mail is either empty or improperly formed.');

// authenticate input against database documents
UserSchema.statics.authenticate = function(email, password, callback) {
  User.findOne({ email: email.toLowerCase() })
      .exec(function (error, user) {
        if (error) {
          return callback(error);
        } else if ( !user ) {
          var err = new Error('Email is not registered.');
          err.status = 401;
          return callback(err);
        }
        bcrypt.compare(password, user.password , function(error, result) {
          if (result === true) {
            return callback(null, user);
          } else {
            return callback();
          }
        })
      });
};

// update the win/loss/draw in results
UserSchema.method("updateRecord", function(result, callback) {
    if (result === "win") {
        this.results.wins += 1;
    } else if (result === "loss") {
        this.results.losses += 1;
    } else {
        this.results.draws += 1;
    }
    this.save(callback);
});

// hash password before saving to database
UserSchema.pre('save', function(next) {
  var user = this;

  // only hash the password if it has been modified (or is new)
  if (!user.isModified('password')) return next();

  bcrypt.hash(user.password, 10, function(err, hash) {
    if (err) { return next(err); }
    user.password = hash;
    next();
  });
});

var User = mongoose.model('User', UserSchema);
module.exports = User;