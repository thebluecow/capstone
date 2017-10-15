
'use strict';

var angular = require('angular');

angular.module('ijwApp')
    .controller('deckBuildCtrl', function($scope, $log, $q, $interval, $uibModal, dataService, config) {

        ! function(vm) {

            var MAX_MOVES = config.MAX_MOVES;
            vm.deck = [];
            vm.error = null;
            vm.actions = [];
            var mission = {};

            // user does not need to be visible to scope
            vm.user = {};

            (function() {
                vm.user._id = dataService.getUserId();
            }());

            // get actions from dataService
            (function() {
                var actions = [];
                dataService.getActions(['_id', 'name', 'description', 'bonuses'])
                    .then(function(result) {
                        var actions = [];
                        actions = (result !== 'null') ? result.data : {};

                        // for building out modal description, hide actual bonus values
                        actions.map( action => {
                            var x = {};
                            for (var bonus in action.bonuses) {
                                if (action.bonuses.hasOwnProperty(bonus)) {
                                    if (action.bonuses[bonus] !== 0) { 
                                        action.bonuses[bonus] = '+';
                                    } else {
                                        delete action.bonuses[bonus];
                                    }
                                }
                            }
                        });
                        vm.actions = actions;

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

            vm.move = function(index, direction) {
                var action = angular.copy(vm.deck[index]); 
                var newIndex = index + direction;

                if (newIndex < (MAX_MOVES - 1)) {
                    vm.deck.splice(index, 1);
                    vm.deck.splice(newIndex, 0, action);
                    vm.error = null;
                } else {
                    vm.error = 'Something went wrong. Please try again.';
                }

            }

            // update the deck if it already exists or create a new one
            vm.updateOrCreateDeck = function() {

                var newDeck = {};

                if (vm.deck.length < MAX_MOVES) {
                    vm.error = 'Action list must contain ' + MAX_MOVES + ' actions to submit.';
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

                // after modifying/creating the deck, route to the /match screen
                dataService.updateOrCreateDeck(newDeck, vm.user._id)
                    .then(result => {
                        dataService.go('/match');
                    }, reason => {
                        $log.error(reason);
                    });
            };

            vm.open = function (action) {

                $uibModal.open({
                    templateUrl: 'modalContent.html', // loads the template
                    backdrop: true, // setting backdrop allows us to close the modal window on clicking outside the modal window
                    windowClass: 'modal', // windowClass - additional CSS class(es) to be added to a modal window template
                    controller: function ($scope, $uibModalInstance, item, description) {
                        $scope.item = item;
                        $scope.close = function () {
                            $uibModalInstance.dismiss('cancel'); 
                        };
                        $scope.description = description;
                    },
                    resolve: {
                        item: function () {
                            return action;
                        },
                        description: function() {
                            var bonusDescription = [];
                            for (var prop in action.bonuses) {
                                if (action.bonuses.hasOwnProperty(prop)) {
                                    if (prop === 'city') {
                                        bonusDescription.push('Are you in a city? Oh dear. Oh yay!');
                                    }

                                    else if (prop === 'desert') {
                                        bonusDescription.push('The desert is so full of extremes. And sand. Lots and lots of sand...');
                                    }

                                    else if (prop === 'extreme') {
                                        bonusDescription.push('Extreme weather (hurricanes, tornados) might come into play');
                                    }

                                    else if (prop === 'rain') {
                                        bonusDescription.push('Is it raining hard? Could be good/bad. Who knows?');
                                    }

                                    else if (prop === 'jungle') {
                                        bonusDescription.push('Only Recondo and snakes love the jungle. Maybe...');
                                    }

                                    else if (prop === 'snow') {
                                        bonusDescription.push('Snow (heavy snow, blizzard, heavy sleet) can do things...');
                                    }
                                }
                            }
                            return bonusDescription;
                        }
                    }
                });//end of modal.open
            }; // end of scope.open function

            return vm;

        }(this);

    })