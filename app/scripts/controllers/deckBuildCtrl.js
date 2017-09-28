
'use strict';

var angular = require('angular');

angular.module('ijwApp')
    .controller('deckBuildCtrl', function($scope, $log, $interval, dataService) {

        ! function(vm) {

            var MAX_ACTIONS = 10;
            vm.deck = [];
            vm.error = null;
            vm.actions = [];

            // get current user (for testing until auth strategy)
            (function() {
                dataService.getUser('59b3d92a026d930c39bd9ed6')
                    .then(function(user) {
                        vm.user = (user !== 'null') ? user.data : {};
                    }, function(reason) {
                        $log.error('USER REASON', reason);
                    });
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

            vm.addToDeck = function(action) {
                if (vm.deck.length < MAX_ACTIONS) {
                    vm.deck.push(action);
                    vm.error = null;
                } else {
                    vm.error = 'Action list can contain no more than ' + MAX_ACTIONS + ' actions.';
                }
            }

            vm.remove = function(index) {
                vm.deck.splice(index, 1);
                vm.error = null;
            }

            vm.clear = function() {
                vm.deck = [];
                vm.error = null;
            }

            vm.updateOrCreateDeck = function() {

                var newDeck = {};

                if (vm.deck.length < MAX_ACTIONS) {
                    vm.error = 'Action list must contain ' + MAX_ACTIONS + ' actions to submit.';
                    return $log.error('Array less than appropriate');
                } else if (vm.user === null) {
                    return $log.error('User is null');
                } else {
                    newDeck.user = {
                        '_id': vm.user._id
                    };
                    newDeck.actions = [];
                    for (var i = 0; i < vm.deck.length; i++) {
                        var action = {
                            '_id': vm.deck[i]._id
                        };
                        newDeck.actions.push(action);
                    }
                }

                dataService.updateOrCreateDeck(newDeck, vm.user._id)
                    .then(result => {
                        dataService.go('/match');
                    }, reason => {
                        $log.error(reason);
                    });
            };

            return vm;

        }(this);

    })