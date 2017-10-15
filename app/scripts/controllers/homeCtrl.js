
'use strict';

var angular = require('angular');

angular.module('ijwApp')
    .controller('homeCtrl', function($scope, $log, $q, $uibModal, dataService) {

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

            vm.open = function (user) {

                $log.info(user);

                $uibModal.open({
                    templateUrl: 'modalContent.html', // loads the template
                    backdrop: true, // setting backdrop allows us to close the modal window on clicking outside the modal window
                    windowClass: 'modal', // windowClass - additional CSS class(es) to be added to a modal window template
                    controller: function ($scope, $uibModalInstance, user) {
                        $scope.user = user;
                        $scope.close = function () {
                            $uibModalInstance.dismiss('cancel'); 
                        };
                    },
                    resolve: {
                        user: function () {
                            return user;
                        }
                    }
                });//end of modal.open
            }; // end of scope.open function

            return vm;

        }(this);

    })