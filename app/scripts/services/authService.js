'use strict';

var angular = require('angular');

angular.module('ijwApp').factory('AuthService', ['$rootScope', '$q', '$timeout', '$http', '$log', function ($rootScope, $q, $timeout, $http, $log) {

    // create user variable
    var user = null;
    var _id = null;
    var admin = null;

    var config = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    function getUserId() {
      return _id;
    }

    function isLoggedIn() {
      if(user) {
        return true;
      } else {
        return false;
      }
    }

    function getUserStatus() {
      return $http.get('/user/status')
      // handle success
      .then(function(response) {
          if (response.data.status === true) {
            user = true;
            $rootScope.loggedIn = true;
            _id = response.data.user;
          } else {
            user = false;
            $rootScope.loggedIn = false;
            _id = null;
          }
      }, function (data) {
        user = false;
      });
    }

    function login(email, password) {

      // create a new instance of deferred
      var deferred = $q.defer();

      // send a post request to the server
      $http.post('/user/login',
        {email: email, password: password}, config)
        // handle success
        .then(function(response) {
            if(response.status === 200){
              user = true;
              _id = response.data.user;
              deferred.resolve();
            } else {
              $log.error(data);
              user = false;
              _id = null;
              deferred.reject();
            }
        }, function(data) {
          user = false;
          _id = null;
          deferred.reject();
        });

      // return promise object
      return deferred.promise;

    }

    function logout() {

      // create a new instance of deferred
      var deferred = $q.defer();

      // send a get request to the server
      $http.get('/user/logout').then(function(data) {
            user = false;
            deferred.resolve();
        }, function(data) {
          console.log('error', data);
          user = false;
          deferred.reject();
        });

      // return promise object
      return deferred.promise;

    }

    function register(email, username, password, confirmPassword) {

      // create a new instance of deferred
      var deferred = $q.defer();

      // send a post request to the server
      $http.post('/user/register', JSON.stringify({email: email, name: username, password: password, confirmPassword: confirmPassword}), config)

        // handle success
        .then(function(data, status) {
            if(/*status === 200 && */data.status === 200){
              deferred.resolve();
            } else {
              $log.error(data);
              deferred.reject();
            }
        }, function(data) {
          user = false;
          deferred.reject();
        });

      // return promise object
      return deferred.promise;

    }

    function getUserRoles() {
        return $http.get('/api/users/' + _id)
        // handle success
        .then(function(response) {
             if (response.data.roles.includes('admin')) {
                admin = true;
            } else {
                $log.info('not an admin');
                admin = false;
            }
        }, function (data) {
            admin = false;
        });
    }

    function isAdmin() {
      if(admin) {
        return true;
      } else {
        return false;
      }
    }

    // return available functions for use in the controllers
    return ({
      isLoggedIn: isLoggedIn,
      getUserStatus: getUserStatus,
      login: login,
      logout: logout,
      register: register,
      getUserId: getUserId,
      getUserRoles: getUserRoles,
      isAdmin: isAdmin
    });

}]);