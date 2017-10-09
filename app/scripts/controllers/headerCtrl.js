
'use strict';

var angular = require('angular');

// http://www.christophbrill.de/en_US/marking-bootstrap-navigation-tags-as-active-using-angularjs/
angular.module('ijwApp')
    .controller('headerCtrl', function($scope, $log, $location) {

        $scope.isActive = function(viewLocation) {
            return viewLocation === $location.path();
        };

    })