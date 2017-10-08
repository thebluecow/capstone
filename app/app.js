'use strict';

var angular = require('angular');
var angularUtils = require('angular-utils-pagination');
var xeditable = require('angular-xeditable');

angular.module('ijwApp', ['ngRoute', 'angularUtils.directives.dirPagination', 'xeditable'])
.constant('config', {
	'appName': 'ijw',
	'appVersion': '1.0',
	'BONUSES': {
		'min': -20,
		'max': 20
	},
	'MAX_MOVES': 10,
	'MOMENTUM': 4
});

require('./route-config.js');
require('./scripts/controllers/loginCtrl.js');
require('./scripts/controllers/logoutCtrl.js');
require('./scripts/controllers/registerCtrl.js');
require('./scripts/controllers/homeCtrl.js');
require('./scripts/controllers/deckBuildCtrl.js');
require('./scripts/controllers/headerCtrl.js');
require('./scripts/controllers/matchCtrl.js');
require('./scripts/controllers/missionCtrl.js');
require('./scripts/controllers/adminCtrl.js');
require('./scripts/directives/app.js');
require('./scripts/services/authService.js');
require('./scripts/services/dataService.js');
require('./scripts/services/gameService.js');