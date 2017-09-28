'use strict';

var angular = require('angular');

angular.module('ijwApp', ['ngRoute']);

require('./route-config.js');
require('./scripts/controllers/loginCtrl.js');
require('./scripts/controllers/deckBuildCtrl.js');
require('./scripts/controllers/matchCtrl.js');
require('./scripts/controllers/missionCtrl.js');
require('./scripts/directives/app.js');
require('./scripts/services/dataService.js');
require('./scripts/services/gameService.js');