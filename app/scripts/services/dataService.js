
'use strict';

var angular = require('angular');
var api = require('../../../src/api.json');

angular.module('ijwApp')
    .service("dataService", function($http, $log, $q, $location, $httpParamSerializer) {

        ! function(vm) {

            // The base URL for the REST API is http://localhost:5000/
            const HOME = 'http://localhost:3000';
            let config = {
                //headers : { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            /* BEGIN VARIABLES EXCLUSIVE TO MAP AND WEATHER APIS */

            var mission = {};
            var weather = {};
            var _actions = {};

            var weatherURL = 'http://api.openweathermap.org/data/2.5/weather';
            var timezonedbURL = 'http://api.timezonedb.com/v2/get-time-zone?key=';

            // longitude, latitude format
            var locations = [
                {
                 "city": {
                        "location": "Amazon",
                        "global": [-62.215881, -3.465305],
                        "title": "Deep in the Amazon",
                        "story": "The jungle is alive with Cobra operatives.",
                        "terrain": "jungle",
                        "offset": 0
                    }
                },
                {
                    "city": {
                        "location": "Russia, Novosibirsk",
                        "global": [82.93573270000002, 55.00835259999999],
                        "title": "Sibera Novosibirsk",
                        "story": "Cobra siezes control of the Russian servers, posting fake news on FaceBook.",
                        "terrain": "city",
                        "offset": 11
                    }
                },
                {
                    "city": {
                        "location": "Bruges, Belgium",
                        "global": [3.2246995000000425, 51.209348],
                        "title": "In Bruges?",
                        "story": "GI Joe finds Cobra operatives hiding away in a small bread and breakfast in Bruges, Belgium. In Bruges?",
                        "terrain": "city",
                        "offset": 6
                    }
                },
                {
                    "city": {
                        "location": "Kalahari Desert",
                        "global": [21.093731, -25.592021],
                        "title": "Sand, Sand, Everywhere ",
                        "story": "Cobra has taken shelter in southern Africa, building B.A.T.S. and robotic cheetahs that meow in code.",
                        "terrain": "desert",
                        "offset": 6
                    }
                }
            ];

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

            function _getRandomInt(min, max) {
                min = Math.ceil(min);
                max = Math.floor(max);
                return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
            }

            /* END FUNCTIONS EXCLUSIVE TO MAP AND WEATHER APIS */

            // GET /api/actions - Gets all of the actions.
            vm.getAllActions = function() {
                return $http.get(HOME + '/api/actions');
            };

            // GET /api/actions/all - Gets all of the actions.
            // TODO - remove this after switching up its call
            vm.getActionValues = function() {
                return $http.get(HOME + '/api/actions/all');
            };

            // GET /api/users/:userId - Gets a single user
            vm.getUser = function(userId) {
                return $http.get(HOME + '/api/users/' + userId);
            }

            // GET /api/decks - Gets all decks
            vm.getAllDecks = function() {
                return $http.get(HOME + '/api/decks');
            }

            // GET /api/decks/user/:userId - Gets all decks by a user (should only be one)
            vm.getUserDecks = function(userId) {
                return $http.get(HOME + '/api/decks/user/' + userId);
            }

            // POST /api/users/:userId/results-win - updates the user's record
            vm.updateUserRecord = function(userId, result) {
                return $http.post(HOME + '/api/users/' + userId + '/result-' + result);
            }

            // POST /api/matches - Creates a match for the specified user
            vm.createMatch = function(match) {
                return $http.post(HOME + '/api/matches', JSON.stringify(match), config);
            }

            // GET /api/matches/user/:userId - Gets the most recent match for the user
            vm.getUserMatches = function(userId) {
                return $http.get(HOME + '/api/matches/user/' + userId);
            }

            // POST /api/decks - Create a deck for the specified user
            vm.updateOrCreateDeck = function(deck, userId) {
                return $http.post(HOME + '/api/decks/user/' + userId, JSON.stringify(deck), config);
            }

            // DELETE /api/decks/:deckId
            vm.deleteDeck = function(deckId) {
                return $http.delete(HOME + '/api/decks/' + deckId);
            }

            // redirect browser to path
            vm.go = function(path) {
                return $location.path(path);
            };

            return vm;

        }(this);

    });