describe("Unit Testing deckBuildCtrl", function() {

  let ctrl;
  let deck;
  let MAX_ACTIONS = 10;

  beforeEach(angular.mock.module('ijwApp'));
  
  beforeEach(inject(function(_$controller_,_$rootScope_,_$q_,_$log_,_$interval_,_$httpBackend_) {
    $controller = _$controller_;
    $scope = _$rootScope_.$new();
    $q = _$q_;
    $log = _$log_;
    $interval = _$interval_;
    $httpBackend = _$httpBackend_;

   getGameDataMock = {
      getCurrentUser: function(callback) {
        var response = {
            "_id": "59b3d92a026d930c39bd9ed6",
            "email": "macgyver@eighties.com",
            "password": "$2a$10$nkNfETF79a9/Hikz83aG0.VRdck4zpUgB3Xsd5hqB7GGaRzYwLiYi",
            "name": "Angus MacGyver",
            "__v": 0,
            "results": {
                "draws": 0,
                "losses": 2,
                "wins": 32
            },
            "achievements": [],
            "roles": [
                "user"
            ]
        };

        var deferred = $q.defer();
        deferred.resolve(response);
        return deferred.promise;
      },
      getActions: function(callback) {
        var response = {};
        response.status = 200;
        response.data = [
          {
              "_id": "59b3d655bb644f0c119e5f5f",
              "name": "What Could Go Wrong? Hire Zartan"
          },
          {
              "_id": "59b3d655bb644f0c119e5f4a",
              "name": "Weather Dominator Strike!"
          },
          {
              "_id": "59b3d655bb644f0c119e5f5b",
              "name": "Vance Wingfield Plots Overthrow"
          },
          {
              "_id": "59b3d655bb644f0c119e5f4d",
              "name": "Time for the Night Vision Goggles"
          },
          {
              "_id": "59b3d655bb644f0c119e5f53",
              "name": "T-11 Parachute"
          },
          {
              "_id": "59b3d655bb644f0c119e5f38",
              "name": "Snake Eye's Uzi"
          },
          {
              "_id": "59b3d655bb644f0c119e5f55",
              "name": "Smurfy Snake Eye's"
          },
          {
              "_id": "59b3d655bb644f0c119e5f39",
              "name": "Sidekick! Timber Joins"
          },
          {
            "_id": "59b3d655bb644f0c119e5f57",
            "name": "Red Rocket Franchise"
          },
          {
            "_id": "59b3d655bb644f0c119e5f4e",
            "name": "PRC-117 Radios HQ"
          }
        ];

        var deferred = $q.defer();
        deferred.resolve(response);
        return deferred.promise;
      },
      updateOrCreateDeck: function(deck, userId) {
        var result = {
          status: 200
        };
        var deferred = $q.defer();
        deferred.resolve(response);
        return deferred.promise;
      },
      go: function(location) {
        $httpBackend.when('GET', '/match').respond(200, { match: true} );
        $httpBackend.flush();
      }
    }


    ctrl = $controller('deckBuildCtrl', { $scope: $scope, $log: $log, $interval: $interval, dataService: getGameDataMock});

  }));

  
  it('should pass a simple test: true = true', function() {
   expect(true).to.equal(true);
   });

  it('should have a deckBuildCtrl', function() {
    expect(ctrl).to.not.be.undefined;
  });

  it('should verify getAllUsers service exists', inject(function() {
    $scope.$digest();
    expect(getGameDataMock.getCurrentUser).to.exist;;
  }));

  it('should verify getActions service exists', inject(function() {
    $scope.$digest();
    expect(getGameDataMock.getActions).to.exist;;
  }));

  it('should set user', inject(function() {
    $scope.$digest();
    expect(ctrl.user).to.exist;
    expect(ctrl.user.name).to.equal('Angus MacGyver');
  }));

  it('should set actions', inject(function() {
    $scope.$digest();
    expect(ctrl.actions).to.exist;
    expect(ctrl.actions).to.have.lengthOf(10);
    expect(ctrl.actions[6]['name']).to.equal('Smurfy Snake Eye\'s');
  }));

  it ('should allow the additiona of items to deck', inject(function() {

    $scope.$digest();
    ctrl.addToDeck({"_id": "59b3d655bb644f0c119e5f48", "name": "S.H.A.R.C. Attack!"});
    expect(ctrl.error).to.be.null;
    expect(ctrl.deck).to.have.lengthOf(1);

  }));

  it('should clear the deck', inject(function() {
    $scope.$digest();
    ctrl.addToDeck({"_id": "59b3d655bb644f0c119e5f48", "name": "S.H.A.R.C. Attack!"});
    expect(ctrl.deck).to.have.lengthOf(1);
    ctrl.clear();
    expect(ctrl.deck).to.have.lengthOf(0);
  }));

  it('should not allow the addition of actions to deck past ' + MAX_ACTIONS, inject(function() {
    $scope.$digest();
    ctrl.deck = ctrl.actions;
    expect(ctrl.deck).to.have.lengthOf(10);
    ctrl.addToDeck({"_id": "59b3d655bb644f0c119e5f48", "name": "S.H.A.R.C. Attack!"});
    expect(ctrl.deck).to.have.lengthOf(10);
    expect(ctrl.error).to.equal('Action list can contain no more than ' + MAX_ACTIONS + ' actions.');
  }));

  it('should remove item at specified deck location', inject(function() {
    $scope.$digest();
    ctrl.deck = ctrl.actions;
    expect(ctrl.deck).to.have.lengthOf(10);
    expect(ctrl.deck[3].name).to.equal('Time for the Night Vision Goggles');
    ctrl.remove(3);
    expect(ctrl.deck[3].name).to.not.equal('Time for the Night Vision Goggles');
    expect(ctrl.deck[3].name).to.equal('T-11 Parachute');
  }));

});