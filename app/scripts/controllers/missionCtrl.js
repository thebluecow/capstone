
'use strict';

var angular = require('angular');

angular.module('ijwApp')
    .controller('missionCtrl', function($scope, $log, $interval, dataService) {

        ! function(vm) {

            var mission = {};
            var weather = {};

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

            function convertUnixTime(time) {
                return new Date(time * 1000).toString().substring(4, 24);
            }

            function convertToFahrenheit(temp) {
                return (1.8 * (temp - 273) + 32).toFixed(2);
            }

            vm.playGame = function() {
                dataService.getUserDecks('59b3d92a026d930c39bd9ed6')
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