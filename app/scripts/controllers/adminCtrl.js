
'use strict';

var angular = require('angular');

angular.module('ijwApp')
    .controller('adminCtrl', function($scope, $log, $q, $interval, dataService, config) {

        ! function(vm) {

            /*vm.user = {
                _id: dataService.getUserId()
            };*/

            vm.actionForm = {};
            vm.errorMessage = [];
            vm.error = false;
            vm.sortKey = 'name';
            vm.reverse = false;

            // set bonus min and max
            var BONUSES = {
                'min': config.BONUSES.min,
                'max': config.BONUSES.max
            };
            
            // get all actions from dataService
            (function() {
                dataService.getAllActions().then( actions => {
                    vm.actions = actions.data;
                }, error => {
                    $log.error(error);
                });
            }());

            // updates the status of an action to either true or false
            vm.actionStatus = function(actionId, status, $index) {
                dataService.updateActionStatus(actionId, status)
                .then(function() {
                    vm.actions[$index].active = (status === 'enable') ? true : false;
                })
            }

            // updates the values of actions
            vm.updateActionValues = function() {
                dataService.updateActionValues()
                .then(function() {
                    dataService.getAllActions().then( actions => {
                        vm.actions = actions.data;
                        $log.info(actions.data);
                    }, error => {
                        $log.error(error);
                    });
                })
            }

            // used to sort the tables
            vm.sort = function(header) {
                vm.sortKey = header;
                vm.reverse = !vm.reverse;
            }

            // validates if action can be saved
            vm.validateAction = function(action) {
                var error = '';
                var valid = true;

                if (action.name === 'undefined' || action.name.length === 0) {
                    error = 'Action name must be populated.';
                    vm.errorMessage.push(error);
                    valid = false;
                }

                for (var bonus in action.bonuses) {
                    if (action.bonuses.hasOwnProperty(bonus)) {
                        if (action.bonuses[bonus] < BONUSES.min || action.bonuses[bonus] > BONUSES.max || action.bonuses[bonus] === undefined ) {
                            error = `Bonus value ${bonus} must fall between ${BONUSES.min} and ${BONUSES.max}.`;
                            vm.errorMessage.push(error);
                            valid = false;
                        }
                    }
                }

                return valid;
            }

            // validates if a bonus value falls within the min/max
            vm.validateBonuses = function(bonus) {

                if (typeof bonus === "number") {
                    if (bonus < BONUSES.min || bonus > BONUSES.max || bonus === undefined) {
                        return `Value must fall between ${BONUSES.min} and ${BONUSES.max}.`;
                    }
                } else {
                    return `Value must be a number.`;
                }
                
                return true;
            }

            // validates if the name is present
            vm.validateName = function(name) {
                if (name === undefined || name.length === 0) {
                    return `Name cannot be null.`;
                }

                return true;
            }

            // first validates the action, then saves
            vm.saveAction = function($index) {
                var action = angular.copy(vm.actions[$index]);
                
                // validate if name and bonus values are valid
                if (vm.validateAction(action)) {
                    // if action._id is undefined, create a new action
                    if (action._id === undefined) {
                        dataService.createAction(action)
                        .then(function() {
                            vm.error = false;
                            vm.errorMessage = null;
                        }, function(err) {
                            vm.error = true;
                            vm.errorMessage = err;
                        });
                    } else {
                        // save existing action
                        dataService.updateActionBonuses(action._id, action)
                        .then(function() {
                            vm.error = false;
                            vm.errorMessage = null;
                        }, function(err) {
                            vm.error = true;
                            vm.errorMessage = err;
                        });
                    }  
                } else {
                    vm.error = true;
                }
            }

            // add user
          vm.addAction = function() {
            // insert a new action into the vm.actions array
            vm.inserted = {
              name: '',
              active: false,
              value: 0,
              bonuses: {
                city: 0,
                jungle: 0,
                desert: 0,
                extreme: 0,
                rain: 0,
                snow: 0
              }
            };
            vm.actions.push(vm.inserted);
          };

            return vm;

        }(this);

    })