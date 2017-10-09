
'use strict';

var angular = require('angular');

angular.module('ijwApp')
    .controller('deckBuildCtrl', function($scope, $log, $interval, dataService, config) {

        ! function(vm) {

            var MAX_MOVES = config.MAX_MOVES;
            vm.deck = [];
            vm.error = null;
            vm.actions = [];
            var mission = {};

            // user does not need to be visible to scope
            var user = {};

            (function() {
                user._id = dataService.getUserId();
            }());

            // get actions from dataService
            (function() {
                dataService.getActions(['_id', 'name'])
                    .then(function(result) {
                        vm.actions = (result !== 'null') ? result.data : {};
                    }, function(reason) {
                        $log.error(reason);
                    });
            }());

            // get mission from dataService
            (function() {
                mission = dataService.getMission();
                vm.title = mission.location.title;
                vm.story = mission.location.story;
            }());


            // add an action to the deck
            vm.addToDeck = function(action) {
                if (vm.deck.length < MAX_MOVES) {
                    vm.deck.push(action);
                    vm.error = null;
                } else {
                    vm.error = 'Action list can contain no more than ' + MAX_MOVES + ' actions.';
                }
            }

            // remove an action from the deck
            vm.remove = function(index) {
                vm.deck.splice(index, 1);
                vm.error = null;
            }

            // clear the deck
            vm.clear = function() {
                vm.deck = [];
                vm.error = null;
            }

            // update the deck if it already exists or create a new one
            vm.updateOrCreateDeck = function() {

                var newDeck = {};

                if (vm.deck.length < MAX_MOVES) {
                    vm.error = 'Action list must contain ' + MAX_MOVES + ' actions to submit.';
                    return $log.error('Array less than appropriate');
                } else if (user === null) {
                    return $log.error('User is null');
                } else {
                    newDeck.user = {
                        '_id': user._id
                    };
                    newDeck.actions = [];
                    for (var i = 0; i < vm.deck.length; i++) {
                        var action = {
                            '_id': vm.deck[i]._id
                        };
                        newDeck.actions.push(action);
                    }
                }

                // after modifying/creating the deck, route to the /match screen
                dataService.updateOrCreateDeck(newDeck, user._id)
                    .then(result => {
                        dataService.go('/match');
                    }, reason => {
                        $log.error(reason);
                    });
            };

            return vm;

        }(this);

    })