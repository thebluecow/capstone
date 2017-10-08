
'use strict';

var angular = require('angular');

angular.module('ijwApp')
    .controller('homeCtrl', function($scope, $log, $q, dataService) {

        ! function(vm) {

            // get user from dataService
            (function() {
                dataService.getAllUsers().then( users => {
                    vm.users = users.data;
                }, error => {
                    $log.error(error);
                });
            }());

            // used to sort table
            vm.sort = function(header) {
                vm.sortKey = header;
                vm.reverse = !vm.reverse;
            }

            // returns a float as string
            vm.returnPercentage = function(user) {
                var float = parseFloat(user.results.wins / (user.results.wins + user.results.losses) * 100).toFixed(2);
                if (isNaN(float)) {
                    float = '0.00';
                }
                return float;
            }

            return vm;

        }(this);

    })