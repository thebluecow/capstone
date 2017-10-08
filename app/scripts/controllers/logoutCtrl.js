'use strict';

var angular = require('angular');

angular.module('ijwApp').controller('logoutCtrl',
  ['$scope', '$location', 'AuthService',
  function ($scope, $location, AuthService) {

    $scope.logout = function () {

    	// initial values
      $scope.error = false;

      // call logout from service
      AuthService.logout()
        .then(function () {
          $location.path('/login');
        })
        .catch(function() {
        	$scope.error = true;
          	$scope.errorMessage = "There's an error on logout";
        });

    };

}]);