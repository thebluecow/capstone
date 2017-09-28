
'use strict';

var angular = require('angular');

angular.module('ijwApp')
    .controller('matchCtrl', function($scope, $log, $interval, dataService, gameService) {

        ! function(vm) {

            vm.user = {
                '_id': '59b3d92a026d930c39bd9ed6'
            };

            vm.active = {
                elm: -1
            };

            vm.deck_active = {
                elm: -1
            };

            vm.error = null;

            // get all users' decks
            (function() {
                dataService.getAllDecks()
                    .then(function(decks) {
                        vm.decks = (decks !== 'null') ? decks.data : {};
                    }, function(reason) {
                        $log.error(reason);
                    });
            }());

            // get user's last match
            (function() {
                dataService.getUserMatches(vm.user._id)
                    .then(function(matches) {
                        vm.matches = (matches !== 'null') ? matches.data : {};
                    }, function(reason) {
                        $log.error(reason);
                    });
            }());

            var _createMatch = function(results) {
                var match = {
                    "deck_one"  : results.deck_one,
                    "deck_two"  : results.deck_two,
                    "story"     : results.story,
                    "reason"    : results.reason
                };

                if (results.winner === 'player 1') {
                    match.winner = results['player 1']['_id'];
                } else if (results.winner === 'player 2') {
                    match.winner = results['player 2']['_id'];
                }

                dataService.createMatch(match)
                .then(function(result) {
                    dataService.go('/results');
                }, function(reason) {
                    $log.error(reason);
                });

            }

            vm.deleteDeck = function(deckId, index) {
                dataService.deleteDeck(deckId)
                    .then(function(deck) {
                        vm.decks.splice(index, 1);
                    }, function(reason) {
                        $log.error(reason);
                    });
            };

            vm.buildDeck = function() {
                dataService.go('/deck');
            }

            vm.smackdown = function() {
                var opponent = angular.element(document.getElementsByClassName('opponent-selected'));
                var userDeck = angular.element(document.getElementsByClassName('deck-row-selected'));
                $log.info(userDeck);
                var results = {};
                if (opponent.length > 0 && userDeck.length > 0) {
                    // player1 is logged in user
                    var player1 = vm.decks[vm.deck_active.elm];
                    // player2 is chosen opponent
                    var player2 = vm.decks[vm.active.elm];

                    console.log('play1', player1);
    
                    results = gameService.playGame(player1, player2);

                    vm.error = null;
                } else {
                    vm.error = 'You must choose an opponent and a deck to continue.';
                }
            }

            return vm;

        }(this);

    })