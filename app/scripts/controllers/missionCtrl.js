
'use strict';

var angular = require('angular');

angular.module('ijwApp')
    .controller('missionCtrl', function($scope, $log, $interval, dataService) {

        ! function(vm) {

            var mission = {};
            var weather = {};

            var userId = null;

            (function() {
                dataService.getUserId();
            }());

            // get mission from dataService
            (function() {
                mission = dataService.getMission();
                dataService.getWeather().then(function(result) {
                    vm.weather = result.weather;
                    vm.timezone = result.timezone;
                    vm.latitude = vm.weather.coord.lat;
                    vm.longitude = vm.weather.coord.lon;
                    vm.temp = vm.weather.main.temp;
                    vm.humidity = vm.weather.main.humidity;
                    vm.conditions = vm.weather.weather['0']['main'];
                    vm.icon = vm.weather.weather['0']['icon'];
                    vm.windspeed = vm.weather.wind.speed;
                    vm.local = vm.timezone.formatted;
                });

                vm.coordinates = mission;
                vm.title = mission.location.title;
                vm.story = mission.location.story;

            }());

            // routes user based on if deck is already created
            vm.playGame = function() {
                dataService.getUserDecks(userId)
                    .then(function(deck) {
                        if (deck.data.length > 0) {
                            dataService.go('/match');
                        } else {
                            dataService.go('/deck');
                        }
                    }, function(reason) {
                        $log.error(reason);
                    });
            }

            // Gets called when the directive is ready:
            vm.callback = function(map) {
                // Map is available here to use:
                map.center = [82.93573270000002, 55.00835259999999];
            };

            return vm;

        }(this);

    })