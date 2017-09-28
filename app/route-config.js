
(function() {
  'use strict';

  // The Angular $routeProvider is used to configure routes for your application.
  
  // Three routes are configured below:
  // 1) The root of the application "/" which serves up the "Recipes" view.
  // 2) The recipe edit route "/edit/:id" which serves up the "Recipe Detail" view.
  // 3) The recipe add route "/add" which also serves up the "Recipe Detail" view.

  // TODO Uncomment this code after you've configured the `app` module.
  
   angular
     .module('ijwApp')
     .config(config);

   function config($locationProvider, $routeProvider) {

    $locationProvider.hashPrefix('!');

     $routeProvider
     .when('/login', {
         controller: 'loginCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/login.html'
     })
     .when('/logout', {
         controller: 'loginCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/login.html'
     })
      .when('/about', {
         controller: 'loginCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/about.html'
     })
      .when('/profile', {
         controller: 'deckBuildCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/profile.html'
     })
      .when('/mission', {
         controller: 'missionCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/mission.html'
     })
       .when('/deck', {
         controller: 'deckBuildCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/deck-build.html'
       })
     .when('/match', {
         controller: 'matchCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/match.html'
     })
     .when('/results', {
         controller: 'matchCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/results.html'
     })
       .otherwise({
         redirectTo: '/'
       });
   }
})();