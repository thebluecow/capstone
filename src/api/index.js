
'use strict';

var express = require("express");
var router = express.Router();
var mid = require('../middleware');
var Action = require('../models/action');
var User = require('../models/user');
var Deck = require('../models/deck');
var Match = require('../models/match');
var History = require('../models/history');
var mongoose = require('mongoose');
var passport = require('passport');
var Schema = mongoose.Schema;

// get action from database
router.param("aID", function(req, res, next, id) {
    Action.findById(id, '_id name')
        .exec(function(err, action) {
            if (err) return next(err);
            if (!action) {
                err = new Error("Not Found");
                err.status = 404;
                return next(err);
            }
            req.action = action;
            return next();
        });
});

// get user from database
router.param("uID", function(req, res, next, id) {
    User.findById(id)
        .exec(function(err, user) {
            if (err) return next(err);
            if (!user) {
                err = new Error("Not Found");
                err.status = 404;
                return next(err);
            }
            req.user = user;
            return next();
        });
});

// get deck from database
router.param("dID", function(req, res, next, id) {
    Deck.findById(id)
        .populate([{
            path: 'actions',
            select: 'name value'
        }, {
            path: 'user',
            select: 'name results'
        }])
        .exec(function(err, deck) {
            if (err) return next(err);
            if (!deck) {
                err = new Error("Not Found");
                err.status = 404;
                return next(err);
            }
            req.deck = deck;
            return next();
        });
});

/* GET home */
router.get('/', function(req, res, next) {
    res.render('index', {});
});

// GET /actions
// route to get all actions
router.get('/actions', (req, res, next) => {
    Action.find({})
        .sort({
            name: -1
        })
        .exec(function(err, actions) {
            if (err) {
                res.status(400);
                return next(err);
            }
            res.status(200);
            res.json(actions);
        });
});

// GET /actions/all
// route to get all actions id and value only
// TODO - REMOVE THIS
router.get('/actions/all', (req, res, next) => {
    Action.find({})
        .select('_id value bonuses name')
        .sort({
            name: -1
        })
        .exec(function(err, actions) {
            if (err) {
                res.status(400);
                return next(err);
            }
            res.status(200);
            res.json(actions);
        });
});

// POST /action
// route to create a match
router.post('/actions', (req, res, next) => {
    var action = new Action(req.body);
    action.save(function(err, action) {
        if (err) {
            res.status(400);
            return next(err);
        }
        res.status(201);
        res.json(action);
    });
});

// GET /actions/:aID
// route to get a specific action
router.get('/actions/:aID', (req, res, next) => {
    res.status(200);
    res.json(req.action);
});

// PUT /actions/:aID
// route to update an action
router.put('/actions/:aID', (req, res, next) => {
    req.action.update(req.body, {"new": true}, function(err, result){
        if(err) {
            res.status(400);
            return next(err);
        }
        res.status(204);
        res.location('/');
        res.json(result);
    });
});

// GET /actions/:aID
// route to get a specific action
router.post('/actions/:aID/status-:dir',
     function(req, res, next){
        if(req.params.dir.search(/^(enable|disable)$/) === -1) {
            var err = new Error("Not Found");
            err.status = 404;
            next(err);
        } else {
            req.status = req.params.dir;
            next();
        }
    }, 
    function(req, res, next){
        req.action.updateStatus(req.status, function(err, action){
            if(err) return next(err);
            res.json(action);
        });
});

// GET /users
// route to get all users
router.get('/users', (req, res, next) => {
    User.find({})
    .select('email champion name results achievements roles')
        .sort({
            name: -1
        })
        .exec(function(err, users) {
            if (err) {
                res.status(400);
                return next(err);
            }
            res.status(200);
            res.json(users);
        });
});

// POST /users/:uID/result-win
// POST /users/:uID/result-loss
// POST /users/:uID/result-draw
router.post("/users/:uID/result-:dir", 
    function(req, res, next){
        if(req.params.dir.search(/^(win|loss|draw)$/) === -1) {
            var err = new Error("Not Found");
            err.status = 404;
            next(err);
        } else {
            req.result = req.params.dir;
            next();
        }
    }, 
    function(req, res, next){
        req.user.updateRecord(req.result, function(err, user){
            if(err) return next(err);
            res.json(user);
        });
});

// GET /users/:uID
// route to get a specific user
router.get('/users/:uID', (req, res, next) => {
    res.status(200);
    res.json(req.user);
});

// GET /decks
// route to get all decks with deep population
router.get('/decks', (req, res, next) => {
    Deck.find({})
        .sort({
            name: -1
        })
        .populate([{
            path: 'actions',
            select: 'name'
        }, {
            path: 'user',
            select: 'name results achievements'
        }])
        .exec(function(err, decks) {
            if (err) {
                res.status(400);
                return next(err);
            }
            res.status(200);
            res.json(decks);
        });
});

// GET /decks/:dID
// route to get a specific user
router.get('/decks/:dID', (req, res, next) => {
    res.status(200);
    res.json(req.deck);
});

// POST /decks/:deckId
// route to create or replace a specific deck
router.post('/decks/user/:userId', (req, res, next) => {
    if (!req.body.user) {
        req.body.user = { '_id' : req.params.userId };
    }
        Deck.update({ 
        'user': req.params.userId
    }, req.body, { 'upsert': true, setDefaultsOnInsert: true})
    .exec(function(err, deck) {
        if (err) {
            res.status(400);
            return next(err);
        }

        res.status(200);
        res.json(deck);
    });
});

// GET /decks/user/:userId
// route to get a specific user's decks
router.get('/decks/user/:userId', (req, res, next) => {
    if (req.params.userId !== null) {
        Deck.find({
            'user': req.params.userId
        })
        .populate([{
            path: 'actions',
            select: 'name value'
        }, {
            path: 'user',
            select: 'name results'
        }])
        .exec(function(err, decks) {
            if (err) {
                res.status(400);
                return next(err);
            }
            res.status(200);
            res.json(decks);
        });
    } else {
        res.status(200);
        res.json([]);
    }
});

// DELETE /deck
router.delete('/decks/:id', function(req, res) {
    var id = req.params.id;

    Deck.remove({
        '_id': id
    }, function(err, deck) {
        if (err) {
            return res.status(500).json({
                err: err.message
            });
        } else {
            res.send('Deck was deleted');
        }
    });
});

// GET /decks
// route to get all decks with deep population
router.get('/matches', (req, res, next) => {
    Match.find({})
        .sort({
            $natural:-1
        })
        .populate([{
                path: 'deck_one',
                populate: [{
                    path: 'user',
                    select: 'name'
                }, {
                    path: 'actions',
                    select: 'name'
                }]
            },
            {
                path: 'deck_two',
                populate: [{
                    path: 'user',
                    select: 'name'
                }, {
                    path: 'actions',
                    select: 'name'
                }]
            },
            {
                path: 'winner',
                populate: {
                    path: 'user',
                    select: 'name'
                }
            }
        ])
        .exec(function(err, decks) {
            if (err) {
                res.status(400);
                return next(err);
            }
            res.status(200);
            res.json(decks);
        });
});

// GET /decks/user/:userId
// route to get a specific user's decks
router.get('/matches/user/:userId', (req, res, next) => {
    var oid = new Schema.Types.ObjectId(req.params.userId);
    Match.find({ $or: [ {'player_one': req.params.userId }, {'player_two': req.params.userId }]})
        .sort({
            $natural:-1
        })
        .populate([{
                path: 'deck_one',
                populate: [{
                    path: 'user',
                    select: 'name results'
                }, {
                    path: 'actions',
                    select: 'name value'
                }]
            },
            {
                path: 'deck_two',
                populate: [{
                    path: 'user',
                    select: 'name'
                }, {
                    path: 'actions',
                    select: 'name value'
                }]
            }
        ])
        .exec(function(err, decks) {
            if (err) {
                res.status(400);
                return next(err);
            }
            res.status(200);
            res.json(decks);
        });
});

// POST /matches
// route to create a match
router.post('/matches', (req, res, next) => {
    var match = new Match(req.body);
    match.save(function(err, match) {
        if (err) {
            res.status(400);
            return next(err);
        }
        res.status(201);
        res.location('/');
        res.json(match);
    });
});

// GET /admin
// route to get admin maintenance page
router.get('/admin', (req, res, next) => {
    // When I make a request to the GET /api/users route with the correct credentials,
    // the corresponding user document is returned
    res.status(200);
    res.json({
        "message": "Admin route will go here."
    });
});

// GET /history
// route to get all histories with deep population
router.get('/history', mid.validateUser, (req, res, next) => {
    History.find({})
        .sort({
            name: -1
        })
        .exec(function(err, histories) {
            if (err) {
                res.status(400);
                return next(err);
            }
            res.status(200);
            res.json(histories);
        });
});

// POST /history
// route to create a history record
router.post('/history', (req, res, next) => {
    Action.find({})
        .sort({
            name: -1
        })
        .exec(function(err, actions) {
            if (err) {
                res.status(400);
                return next(err);
            }

            // create object with form input
            var historyData = {
                "actions": actions,
            };

            // use schema's `create` method to insert document into Mongo
            History.create(historyData, function(error, history) {
                if (error) {
                    return next(error);
                }
                /*else {
			          	res.status(201);
						res.location('/');
						res.json(history);
			        }*/
            });

            Action.setValues(function(error, actions) {
                if (error) {
                    return next(error)
                }
                res.status(201);
                res.location('/');
                res.json();
            });

        });
});

// POST /login
router.post('/login', passport.authenticate('local'), function(req, res, next) {
    passport.authenticate('local', function(err, user, info) {
        if (err) {
            return next(err);
        }

        if (!user) {
            return res.status(401).json({
                err: info
            });
        }
    
        req.logIn(user, function(err) {
            if (err) {
                return res.status(500).json({
                    err: 'Could not log in user'
                });
            }
            res.status(200).json({
                status: 'Login successful!',
                user: req.session.passport.user
            });
        });
    })(req, res, next);
});

// GET /logout
router.get('/logout', function(req, res, next) {
    req.logout();
    res.status(200).json({ status: 'logged out.'});
});

// POST /register
router.post('/register', function(req, res, next) {
  if (req.body.email &&
    req.body.name &&
    req.body.password &&
    req.body.confirmPassword) {

      // confirm that user typed same password twice
      if (req.body.password !== req.body.confirmPassword) {
        var err = new Error('Passwords do not match.');
        err.status = 400;
        return next(err);
      }

      // ensures duplicate usernames cannot be used
      User.findOne({ email: req.body.email })
      .exec(function (error, user) {
        if (error) {
          return next(error);
        } else if ( user ) {
          var err = new Error('User already exists.');
          err.status = 401;
          return next(err);
        }
    });

      // create object with form input
      var userData = {
        email: req.body.email,
        name: req.body.name,
        password: req.body.password
      };

      // use schema's `create` method to insert document into Mongo
      User.create(userData, function (error, user) {
        if (error) {
          return next(error);
        } else {
          return res.status(200).json({
            status: 'Registration successful'
          });
        }
      });

    } else {
      var err = new Error('All fields required.');
      err.status = 400;
      return next(err);
    }
});

// get the user's status
// sets the user as the passport user (mongo _id)
router.get('/status', function(req, res) {
  if (req.isAuthenticated()) {
    return res.status(200).json({
      status: true,
      user: req.session.passport.user
    });
  }
  return res.status(200).json({
    status: false
  });
});



module.exports = router;