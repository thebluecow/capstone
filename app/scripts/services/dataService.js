
'use strict';

var angular = require('angular');
var api = require('../../../src/api.json');
// longitude, latitude format
var locations = require('../../config/locations.json');

angular.module('ijwApp')
    .service("dataService", function($http, $log, $q, $timeout, $location, $httpParamSerializer, AuthService) {

        ! function(vm) {

            // The base URL for the REST API is http://localhost:5000/
            /*const HOME = 'http://localhost:3000';*/
            let config = {
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            var _id = AuthService.getUserId();
            var user = {};

            /* BEGIN VARIABLES EXCLUSIVE TO MAP AND WEATHER APIS */

            var mission = {};
            var weather = {};
            var _actions = {};
            var matches = undefined;

            var weatherURL = 'http://api.openweathermap.org/data/2.5/weather';
            var timezonedbURL = 'http://api.timezonedb.com/v2/get-time-zone?key=';

            var styles = {
                'satellite': 'mapbox://styles/mapbox/satellite-v9',
                'satellite-streets': 'mapbox://styles/mapbox/satellite-streets-v9',
                'streets': 'mapbox://styles/mapbox/streets-v9',
                'outdoors': 'mapbox://styles/mapbox/outdoors-v10',
                'light': 'mapbox://styles/mapbox/light-v9',
                'dark': 'mapbox://styles/mapbox/dark-v9',
                'personal': 'mapbox://styles/thebluecow/cj7t3fpw70uo12sphdf24ihyo'
            };

            /* END VARIABLES EXCLUSIVE TO MAP AND WEATHER APIS */

            /* BEGIN FUNCTIONS EXCLUSIVE TO MAP AND WEATHER APIS */

            // get current mission and weather
            (function() {
                var location = locations[_getRandomInt(0, locations.length)];
                mission.location = location.city;

                var weatherQuery = '?lat=' + mission.location.global[1] + '&lon=' + mission.location.global[0] + '&units=imperial';
                var newWeatherURL = `${weatherURL}${weatherQuery}&APPID=${api.openweather.key}`;
                var p1 = $http.get(newWeatherURL);

                var timezonedbQuery = '&lat=' + mission.location.global[1] + '&lng=' + mission.location.global[0];
                var newTimezoneURL = `${timezonedbURL}${api.timezonedb.apiKey}&format=json&by=position${timezonedbQuery}`;
                var p2 = $http.get(newTimezoneURL);

                weather = $q.all([p1, p2]).then(function (result) {
                                return {
                                    "weather" : result[0]['data'],
                                    "timezone": result[1]['data']
                                }
                            });
            }()); 

            // return the user's id
            vm.getUserId = function() {
                return _id;
            }

            // return only the necessary components for the mission with weather
            vm.getMission = function() {
                return mission;
            }

            // return weather
            vm.getWeather = function() {
                return weather;
            }

            // returns an array of actions. Can return all actions or only those fields
            // specified
            vm.getActions = function (fields) {
                var deferred = $q.defer();

                vm.getAllActions().then( result => {
                    var actions = [];
                    if (fields.length > 0) {
                        result.data.forEach( action => {
                            var _action = {};
                            for (var i = 0; i < fields.length; i++) {
                                _action[fields[i]] = action[fields[i]];
                            }
                            actions.push(_action);
                        });
                        result.data = actions;
                    }

                    deferred.resolve(result);
                });

                return deferred.promise;
            }

            // returns a random integer
            function _getRandomInt(min, max) {
                min = Math.ceil(min);
                max = Math.floor(max);
                return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
            }

            /* END FUNCTIONS EXCLUSIVE TO MAP AND WEATHER APIS */

            // GET /api/actions - Gets all of the actions.
            vm.getAllActions = function() {
                return $http.get('/api/actions');
            };

            // GET /api/actions/all - Gets all of the actions.
            // TODO - remove this after switching up its call
            vm.getActionValues = function() {
                return $http.get('/api/actions/all');
            };

            // GET /api/users/:userId - Gets a single user
            vm.getUser = function(userId) {
                return $http.get('/api/users/' + userId);
            }

             // GET /api/users/- Gets all users
            vm.getAllUsers = function() {
                return $http.get('/api/users/');
            }

            // get the current user's info
            vm.getCurrentUser = function() {
                var deferred = $q.defer();

                // send a get request to the server
                $http.get('/api/users/' + _id).then(function(response) {
                    user = response.data;
                    deferred.resolve(user);
                }, function(error) {
                  $log.error(error);
                  deferred.reject();
                });

                // return promise object
                return deferred.promise;
            }

            // get the current user's matches
            vm.getCurrentUserMatches = function() {
                var deferred = $q.defer();
                var matches = {};

                // send a get request to the server
                $http.get('/api/matches/user/' + _id).then(function(response) {
                    matches = response.data;
                    deferred.resolve(matches);
                }, function(error) {
                  $log.error(error);
                  deferred.reject();
                });

                // return promise object
                return deferred.promise;
            }

            // GET /api/decks - Gets all decks
            vm.getAllDecks = function() {
                return $http.get('/api/decks');
            }

            // GET /api/decks/user/:userId - Gets all decks by a user (should only be one)
            vm.getUserDecks = function(userId) {
                return $http.get('/api/decks/user/' + userId);
            }

            // POST /api/users/:userId/results-win - updates the user's record
            vm.updateUserRecord = function(userId, result) {
                return $http.post('/api/users/' + userId + '/result-' + result);
            }

            // POST /api/users/:userId/results-win - updates the user's record
            vm.updateActionStatus = function(actionId, status) {
                return $http.post('/api/actions/' + actionId + '/status-' + status);
            }

            // POST /api/history - Save and then modify action values
            vm.updateActionValues = function() {
                return $http.post('/api/history/');
            }

            // POST /api/history - Save and then modify action values
            vm.createAction = function(action) {
                return $http.post('/api/actions/', JSON.stringify(action), config);
            }

            // PUT /api/actions/:aID - Update an action
            vm.updateActionBonuses = function(actionId, action) {
                return $http.put('api/actions/' + actionId, JSON.stringify(action), config);
            }

            // POST /api/matches - Creates a match for the specified user
            vm.createMatch = function(match) {
                return $http.post('/api/matches', JSON.stringify(match), config);
            }

            // GET /api/matches/user/:userId - Gets the most recent match for the user
            vm.getUserMatches = function(userId) {
                return $http.get('/api/matches/user/' + userId);
            }

            // POST /api/decks - Create a deck for the specified user
            vm.updateOrCreateDeck = function(deck, userId) {
                return $http.post(/* HOME + */'/api/decks/user/' + userId, JSON.stringify(deck), config);
            }

            // DELETE /api/decks/:deckId
            vm.deleteDeck = function(deckId) {
                return $http.delete(/* HOME + */'/api/decks/' + deckId);
            }

            // redirect browser to path
            vm.go = function(path) {
                return $location.path(path);
            };

            return vm;

        }(this);

    });