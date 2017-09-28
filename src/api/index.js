
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
        .select('_id value bonuses')
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

// GET /actions/:aID
// route to get a specific action
router.get('/actions/:aID', (req, res, next) => {
    res.status(200);
    res.json(req.action);
});

// GET /users
// route to get all users
router.get('/users', (req, res, next) => {
    User.find({})
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
            select: 'name value'
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
    Match.find({ $or: [ {'deck_one.user._id': Schema.Types.ObjectId(req.params.userId) }, {'deck_two.user._id': Schema.Types.ObjectId(req.params.userId) }]})
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
router.get('/admin', mid.validateUser, (req, res, next) => {
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
router.post('/history', mid.validateUser, (req, res, next) => {
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



module.exports = router;