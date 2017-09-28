
'use strict';

var angular = require('angular');
var reporter = require('../js/reportBuilder.js');

angular.module('ijwApp')
    .service("gameService", function($http, $q, $log, dataService) {

        ! function(game) {

            var _actionCount = 10;
            var _actions = {};
            var _weather = {};
            const HOME = 'http://localhost:3000';
            const MOMENTUM = 4;

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

            var verifyDecks = function(player1, player2) {
                var verified = false;

                verified = (player1.actions.length === _actionCount && player2.actions.length === _actionCount);

                return verified;
            };

            var _getValue = function(move, bonuses) {
                var value = 0;
                _actions.forEach(function(action) {
                    if (action._id === move._id) {
                        value = action.value;

                        if (bonuses.condition) {
                            $log.info(bonuses.condition);
                            value += action.bonuses[bonuses.condition];
                        }

                        if (bonuses.mission.location.terrain) {
                            $log.info(bonuses.mission.location.terrain);
                            value += action.bonuses[bonuses.mission.location.terrain];
                        }
                    }
                });
                return value;
            }

            var compareActions = function(action_p1, action_p2) {
                var bonuses = {};
                bonuses.condition = _getWeatherCondition();
                bonuses.mission = dataService.getMission();

                action_p1.value = _getValue(action_p1, bonuses);
                action_p2.value = _getValue(action_p2, bonuses);

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

            function _convertUnixTime(time) {
                //return new Date(time * 1000).toString().substring(4, 24);
                return new Date(time * 1000).toString();
            }

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

                _updateResults(results);

                results.player_1_moves = player1;
                results.player_2_moves = player2;

                return results;
            }

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

                $log.info(results);

                if (results.winner === "player 1") {
                    winnerId = results["player 1"]["_id"];
                    loserId  = results["player 2"]["_id"];
                } else {
                    winnerId = results["player 2"]["_id"];
                    loserId =  results["player 1"]["_id"];
                }

                match.winner = winnerId;
                promiseMatch =  dataService.createMatch(match)
                                .then(function(result) {
                                
                                }, function(reason) {
                                    $log.error('CREATE MATCH REASON', reason);
                                });

                if (results.reason === 'draw') {
                    promiseUser =   dataService.updateUserRecord(winnerId, 'draw')
                                    .then(result => {
                                        //dataService.go('/result');
                                    }, reason => {
                                        $log.error('UPDATE USER RECORD', reason);
                                    });

                    promiseOpp  =   dataService.updateUserRecord(loserId, 'draw')
                                    .then(result => {
                                        // dataService.go('/results');
                                    }, reason => {
                                        $log.error('UPDATE USER RECORD', reason);
                                    });
                }

                else {
                    promiseUser =   dataService.updateUserRecord(winnerId, 'win')
                                    .then(result => {
                                        //dataService.go('/result');
                                    }, reason => {
                                        $log.error('UPDATE USER RECORD', reason);
                                    });

                    promiseOpp  =   dataService.updateUserRecord(loserId, 'loss')
                                    .then(result => {
                                        //dataService.go('/result');
                                    }, reason => {
                                        $log.error('UPDATE USER RECORD', reason);
                                    });
                }

                $q.all([promiseMatch, promiseUser, promiseOpp]).then(function() {
                    dataService.go('/results');
                });
            };

            game.playGame = function(player1, player2) {

                var results = {};
                results['player 1'] = player1.user;
                results['player 2'] = player2.user;
                results.deck_one = player1._id;
                results.deck_two = player2._id;

                $log.info(results);

                // first, verify deck action arrays have the correct length
                if (verifyDecks(player1, player2)) {
                    // loop through actions and return results
                    for (var i = 0; i < _actionCount; i++) {
                        results['move_' + i] = compareActions(player1.actions[i], player2.actions[i]);
                    }

                }

                return _getResults(results);
            }

            return game;

        }(this);

    });