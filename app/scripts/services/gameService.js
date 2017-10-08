
'use strict';

var angular = require('angular');
var reporter = require('../js/reportBuilder.js');

angular.module('ijwApp')
    .service("gameService", function($http, $q, $log, dataService, config) {

        ! function(game) {

            // _actions will hold values from database
            var _actions = {};
            // used for individual play
            var _newActions = {};
            var _weather = {};

            var MAX_MOVES = config.MAX_MOVES;

            const MOMENTUM = config.MOMENTUM;

            // placeholder for later. For the moment, all games will be 'vs'
            // this will allow us to add tournament modes
            var _mode = null;

            // get current all actions with values
            (function() {
                dataService.getActionValues()
                    .then(function(actions) {
                        _actions = (actions !== 'null') ? actions.data : {};
                    }, function(reason) {
                        $log.error(reason);
                    });
            }());

            // get weather conditions
            (function() {
                dataService.getWeather()
                    .then(function(weather) {
                        _weather = (weather !== 'null') ? weather.weather : {};
                        _weather.sunrise = _convertUnixTime(_weather.sys.sunrise);
                        _weather.sunset = _convertUnixTime(_weather.sys.sunset);
                    }, function(reason) {
                        $log.error(reason);
                    });
            }());

            // based on code from openweathermap
            // https://openweathermap.org/weather-conditions
            var _getWeatherCondition = function() {
                var code = parseInt(_weather.weather[0]['id']);
                code = 781;
                var condition = '';
                if (code === 511 || code === 601 || code === 602 || code === 622) {
                    condition = 'snow';
                }
                else if (code === 202 || code === 211 || code === 212 || code === 502 || code === 503 || code === 504)
                {
                    condition = 'rain';
                }
                else if (code === 781 || code === 900 || code === 902 || code === 905 || code === 961 || code === 962)
                {
                    condition = 'extreme';
                }

                return condition;
            }

            // verify decks are of the correct length
            var verifyDecks = function(player1, player2) {
                var verified = false;

                verified = (player1.actions.length === MAX_MOVES && player2.actions.length === MAX_MOVES);

                return verified;
            };

            // returns the action with the new value after bonuses were applied
            // for individual play, random values are first assigned then bonuses are +/-
            var _getValue = function(move, bonuses) {
                var newAction = {};
                var value = 0;

                // use the _newActions array (after randomized) when 'vs mode'
                if (_mode === 'vs') {
                        _newActions.forEach(function(action) {
                        if (action._id === move._id) {
                            value = action.value;
                            newAction.name = action.name;

                            if (bonuses.condition) {
                                value += action.bonuses[bonuses.condition];
                            }

                            if (bonuses.mission.location.terrain) {
                                value += action.bonuses[bonuses.mission.location.terrain];
                            }
                        }
                    });
                } else {
                        _actions.forEach(function(action) {
                        if (action._id === move._id) {
                            value = action.value;
                            newAction.name = action.name;

                            if (bonuses.condition) {
                                value += action.bonuses[bonuses.condition];
                            }

                            if (bonuses.mission.location.terrain) {
                                value += action.bonuses[bonuses.mission.location.terrain];
                            }
                        }
                    });
                }

                newAction.value = value;

                return newAction;
            }

            // based on same randomize function in action model
            // TODO: make this DRY
            var _randomizeValues = function() {
              
              var actionValues = [];
              var totalActions = 0;

              var _buildArray = function() {
                // set max to be half of totalActions
                var max = Math.floor(totalActions / 2);

                // push the same value twice since two actions
                // will have a value of 1, two of 2, etc.
                for (var i = 1; i <= max; i++) {
                  actionValues.push(i);
                  actionValues.push(i);
                }

                totalActions % 2 === 0 ? true : actionValues.push(max + 1);

                // call shuffle function to return the array of shuffled values
                return _shuffle(actionValues);
              };

              // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
              // Fisher-Yates Shuffle Algorithm
              function _shuffle(array) {
                  var currentIndex = array.length, temporaryValue, randomIndex;

                  // While there remain elements to shuffle...
                  while (0 !== currentIndex) {

                    // Pick a remaining element...
                    randomIndex = Math.floor(Math.random() * currentIndex);
                    currentIndex -= 1;

                    // And swap it with the current element.
                    temporaryValue = array[currentIndex];
                    array[currentIndex] = array[randomIndex];
                    array[randomIndex] = temporaryValue;
                  }

                  return array;
              }

              _newActions = angular.copy(_actions);

              totalActions = _newActions.length;
              _buildArray();

              _newActions.map(_newAction => {
                _newAction.value = actionValues.pop();
              }, function(err, result) {
                if (err) {
                    $log.error(err);
                }
              });
            }

            // compare the actions and return the round info (win, loss, tie)
            var compareActions = function(action_p1, action_p2) {
                var bonuses = {};
                bonuses.condition = _getWeatherCondition();
                bonuses.mission = dataService.getMission();

                action_p1 = _getValue(action_p1, bonuses);
                action_p2 = _getValue(action_p2, bonuses);

                var round = {};
                // set round information
                round.player1 = {
                    'name': action_p1.name,
                    'value': action_p1.value
                };

                round.player2 = {
                    'name': action_p2.name,
                    'value': action_p2.value
                };

                // check action values
                if (action_p1.value > action_p2.value) {
                    round.winner = 'player 1';
                    round.diff = (action_p1.value - action_p2.value);
                } else if (action_p2.value > action_p1.value) {
                    round.winner = 'player 2';
                    round.diff = (action_p2.value - action_p1.value);
                } else {
                    round.winner = 'tie';
                    round.diff = 0;
                }

                return round;
            }

            // converts time from openweathermap
            function _convertUnixTime(time) {
                //return new Date(time * 1000).toString().substring(4, 24);
                return new Date(time * 1000).toString();
            }

            // runs through the round information, determining match winner
            var _getResults = function(results) {
                var player1 = 0;
                var player2 = 0;
                var consecutive = 0;
                var last = '';
                var won = false;

                var lastFour = function(property) {
                    var move = property.substring(5, 6);
                    var moves = [];

                    if (!isNaN(move)) {

                        moves.push(parseInt(move));

                        while (moves.length < MOMENTUM) {
                            moves.push(--move);
                        }
                    }

                    return moves;
                };

                for (var property in results) {
                    if (results.hasOwnProperty(property) && !won) {
                        console.log('propery', results[property]);
                        var move = results[property];
                        if (move.winner === 'player 1') {
                            player1++;
                            if (last === 'player 1' || last === '' || last === 'tie') {
                                consecutive++;
                                last = 'player 1';
                            } else {
                                consecutive = 1;
                                last = 'player 1';
                            }
                        } else if (move.winner === 'player 2') {
                            player2++;
                            if (last === 'player 2' || last === '' || last === 'tie') {
                                consecutive++;
                                last = 'player 2';
                            } else {
                                consecutive = 1;
                                last = 'player 2';
                            }
                        } else {
                            last = 'tie';
                            consecutive = 0;
                        }

                        if (consecutive === MOMENTUM) {
                            results.winner = last;
                            results.cause = 'momentum';
                            results.final = lastFour(property);
                            won = true;
                        }
                    }


                }

                if (won && results.cause === 'momentum') {
                    results.reason = 'surrender';
                    results.story = reporter.getStory('momentum', { "player 1" : results["player 1"], "player 2" : results["player 2"], "winner" : results.winner});
                } else if (player1 > player2) {
                    results.winner = 'player 1';
                    results.reason = 'moves';
                    results.story = reporter.getStory('standard', { "player 1" : results["player 1"], "player 2" : results["player 2"], "winner" : results.winner});
                } else if (player2 > player1) {
                    results.winner = 'player 2';
                    results.reason = 'moves';
                    results.story = reporter.getStory('standard', { "player 1" : results["player 1"], "player 2" : results["player 2"], "winner" : results.winner});
                } else {
                    results.winner = 'draw';
                    results.reason = 'draw';
                    results.story = reporter.getStory('draw', { "player 1" : results["player 1"], "player 2" : results["player 2"], "winner" : results.winner});
                }

                // pushes values to match form
                _updateResults(results);

                results.player_1_moves = player1;
                results.player_2_moves = player2;

                // calls the function to return log for controller
                _buildGameLog(results);

                return results;
            }

            // creates a match and also updates both users wins/losses/draws
            var _updateResults = function(results) {
                var promiseUser;
                var promiseOpp;
                var promiseMatch;
                var winnerId;
                var loserId;

                var match = {
                    "deck_one"  : results["deck_one"],
                    "deck_two"  : results["deck_two"],
                    "story"     : results.story,
                    "reason"    : results.reason
                };

                if (results.winner === "player 1") {
                    winnerId = results["player 1"]["_id"];
                    loserId  = results["player 2"]["_id"];
                } else {
                    winnerId = results["player 2"]["_id"];
                    loserId =  results["player 1"]["_id"];
                }

                match.winner = winnerId;
                match.player_one = results["player 1"]["_id"];
                match.player_two = results["player 2"]["_id"];
                
                promiseMatch =  dataService.createMatch(match)
                                .then(function(result) {
                                
                                }, function(reason) {
                                    $log.error(reason);
                                });

                if (results.reason === 'draw') {
                    promiseUser =   dataService.updateUserRecord(winnerId, 'draw')
                                    .then(result => {
                                        //dataService.go('/result');
                                    }, reason => {
                                        $log.error(reason);
                                    });

                    promiseOpp  =   dataService.updateUserRecord(loserId, 'draw')
                                    .then(result => {
                                        // dataService.go('/results');
                                    }, reason => {
                                        $log.error(reason);
                                    });
                }

                else {
                    promiseUser =   dataService.updateUserRecord(winnerId, 'win')
                                    .then(result => {
                                        //dataService.go('/result');
                                    }, reason => {
                                        $log.error(reason);
                                    });

                    promiseOpp  =   dataService.updateUserRecord(loserId, 'loss')
                                    .then(result => {
                                        //dataService.go('/result');
                                    }, reason => {
                                       $log.error(reason);
                                    });
                }

                $q.all([promiseMatch, promiseUser, promiseOpp]).then(function() {
                    dataService.go('/results');
                });
            };

            // build out the results that we want to expose
            var _buildGameLog = function(results) {
                // first delete all the properties we don't need
                var log = angular.copy(results);
                delete log.deck_one;
                delete log.deck_two;
                delete log.story;
                delete log['player 1'];
                delete log['player 2'];
                // hide the values in case a crafty player figures out the values
                // uncomment to hide this information
                /*for (var i = 0; i < MAX_MOVES; i++) {
                    delete log['move_' + i]['player1']['value'];
                    delete log['move_' + i]['player2']['value'];
                    delete log['move_' + i]['diff'];
                }*/

                game.log = log;
            }

            // return the game.log
            // game.log is set in _buildGameLog function
            game.getLastLog = function() {
                if (game.log) { return game.log; }
            }

            // open to controllers
            game.playGame = function(player1, player2, mode) {

                var results = {};
                results['player 1'] = player1.user;
                results['player 2'] = player2.user;
                results.deck_one = player1._id;
                results.deck_two = player2._id;

                _mode = mode;

                if (_mode === 'vs') {
                    _randomizeValues();
                }

                // first, verify deck action arrays have the correct length
                if (verifyDecks(player1, player2)) {
                    // loop through actions and return results
                    for (var i = 0; i < MAX_MOVES; i++) {
                        results['move_' + i] = compareActions(player1.actions[i], player2.actions[i]);
                    }

                }

                return _getResults(results);
            }

            return game;

        }(this);

    });