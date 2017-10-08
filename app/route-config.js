
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
     .config(config)
     .run(run)
     .run(function(editableOptions) {
        editableOptions.theme = 'bs3';
      });

   function config($locationProvider, $routeProvider) {

    $locationProvider.hashPrefix('!');

     $routeProvider
     .when('/', {
         controller: 'homeCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/home.html',
         access: {restricted: true, admin: false}
     })
     .when('/login', {
         controller: 'loginCtrl',
         templateUrl: 'templates/login.html',
         access: {restricted: false, admin: false}
     })
     .when('/logout', {
         controller: 'logoutCtrl',
         access: {restricted: true, admin: false}
     })
     .when('/register', {
         controller: 'registerCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/register.html',
         access: {restricted: false, admin: false}
     })
      .when('/about', {
         templateUrl: 'templates/about.html',
         access: {restricted: false, admin: false}
     })
      .when('/profile', {
         controller: 'matchCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/profile.html',
         access: {restricted: true, admin: false}
     })
      .when('/mission', {
         controller: 'missionCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/mission.html',
         access: {restricted: true, admin: false}
     })
       .when('/deck', {
         controller: 'deckBuildCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/deck-build.html',
         access: {restricted: true, admin: false}
       })
     .when('/match', {
         controller: 'matchCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/match.html',
         access: {restricted: true, admin: false}
     })
     .when('/results', {
         controller: 'matchCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/results.html',
         access: {restricted: true, admin: false}
     })
     .when('/admin', {
         controller: 'adminCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/admin.html',
         access: {restricted: true, admin: true}
     })
       .otherwise({
         redirectTo: '/'
       });
   }

   function run($rootScope, $location, $route, AuthService) {
      $rootScope.$on('$routeChangeStart',
        function (event, next, current) {
          AuthService.getUserStatus()
          .then(function(){
            if (next.access.restricted && !AuthService.isLoggedIn()){
              $location.path('/login');
              $route.reload();
            }
          })
          .then(function() {
            if (next.access.admin) {
              AuthService.getUserRoles()
              .then(function() {
                if (!AuthService.isAdmin()) {
                  $location.path('/');
                  $route.reload();
                }
              })
            }
          });
        });
    }
})();