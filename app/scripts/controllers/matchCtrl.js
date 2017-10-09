
'use strict';

var angular = require('angular');

angular.module('ijwApp')
    .controller('matchCtrl', function($scope, $log, $q, $interval, dataService, gameService, config) {

        ! function(vm) {

            vm.user = {
                _id: dataService.getUserId()
            };
            
            vm.active = {
                elm: -1
            };

            vm.deck_active = {
                elm: -1
            };

            vm.error = null;

            var MAX_MOVES = config.MAX_MOVES;

            // used on controller only
            var _decks = [];
            // available to scope, listing only users with decks
            vm.decks = [];

            // get user from dataService
            (function() {
                dataService.getCurrentUser().then( user => {
                    vm.currentUser = user;
                }, error => {
                    $log.error(error);
                });
            }());

            // get all decks from dataService
            (function() {
                dataService.getAllDecks().then( decks => {
                    _decks = decks.data;
                    _buildDeckArrays(_decks);
                }, error => {
                    $log.error(error);
                });
            }());

            // get user's matches from dataService
            (function() {
                dataService.getCurrentUserMatches().then( matches => {
                    vm.matches = matches;
                }, error => {
                    $log.error(error);
                });
            }());

            // get the last game log from service
            // will be empty if singleton is reloaded
            (function() {
                vm.log = gameService.getLastLog() || null;
            }());

            // as a means of hiding player deck values
            var _buildDeckArrays = function(decks) {
                if (decks.length > 0) {
                    for (var i = 0; i < decks.length; i++) {
                        // create user deck to show user on match page
                        if (decks[i]['user']['_id'] === vm.user._id) {
                            vm.userDeck = decks[i];
                        }
                        // build out the deck values for each user
                        var deck = {};
                        deck.user = decks[i]['user'];
                        deck._id = decks[i]['_id'];
                        var actions = [];
                        // attempting to obfuscate the actions
                        for (var j = 0; j < decks[i]['actions'].length; j++) {
                            var action = {};
                            action._id = decks[i]['actions'][j]['_id'];
                            actions.push(action);
                        }

                        deck.actions = actions;
                        vm.decks.push(deck);
                    }
                }
            }

            // delete the deck from the database
            vm.deleteDeck = function(deckId) {
                dataService.deleteDeck(deckId)
                    .then(function(deck) {
                        vm.userDeck = null;
                    }, function(reason) {
                        $log.error(reason);
                    });
            };

            // route user to /deck
            vm.buildDeck = function() {
                dataService.go('/deck');
            }

            // play the game
            vm.smackdown = function() {
                var opponent = angular.element(document.getElementsByClassName('opponent-selected'));
                var results = {};
                // later we can add a variable on the page
                var mode = 'vs';
                if (opponent.length > 0 && (vm.userDeck !== null || vm.userDeck === undefined)) {
                    var player1 = {};
                    player1.user = vm.userDeck.user;
                    player1.actions = vm.userDeck.actions;
                    player1._id = vm.userDeck._id;

                    // player2 is chosen opponent
                    var player2 = vm.decks[vm.active.elm];
    
                    results = gameService.playGame(player1, player2, mode);

                    vm.error = null;

                } else {
                    vm.error = 'You must choose an opponent and a deck to continue.';
                }
            }

            return vm;

        }(this);

    })