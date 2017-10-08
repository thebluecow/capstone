describe("Unit Testing matchCtrl", function() {

  let ctrl;
  let next = {};

  beforeEach(angular.mock.module('ijwApp'));
  
  beforeEach(inject(function(_$controller_,_$rootScope_,_$log_,_$q_,_$interval_, _$httpBackend_) {
    $controller = _$controller_;
    $scope = _$rootScope_.$new();
    $q = _$q_;
    $log = _$log_;
    $interval = _$interval_;
    $httpBackend = _$httpBackend_;

   gameServiceMock = {
      playGame: function(player1, player2) {
        var response = {};
        var deferred = $q.defer();
        deferred.resolve(response);
        return deferred.promise;
      }
   }

   dataServiceMock = {
      getUserId: function() {
            return "59b3d92a026d930c39bd9ed8";
      },
      getCurrentUser: function() {
        var response = {};
        response = {
                "_id": "59b3d92a026d930c39bd9ed8",
                "email": "scottb@test.com",
                "name": "Scott B",
                "__v": 0,
                "results": {
                    "draws": 0,
                    "losses": 4,
                    "wins": 65
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
      getAllDecks: function(callback) {
        var response = {};
        response.status = 200;
        response.data = [
        {
            "_id": "59b3deef246d150ce329c5ed",
            "user": {
                "_id": "59b3d92a026d930c39bd9ed6",
                "name": "Angus MacGyver",
                "results": {
                    "draws": 0,
                    "losses": 2,
                    "wins": 32
                },
                "achievements": []
            },
            "__v": 0,
            "createDate": "2017-10-06T15:50:31.493Z",
            "actions": [
                {
                    "_id": "59b3d655bb644f0c119e5f5f",
                    "name": "What Could Go Wrong? Hire Zartan",
                    "value": 3
                },
                {
                    "_id": "59b3d655bb644f0c119e5f48",
                    "name": "S.H.A.R.C. Attack!",
                    "value": 11
                },
                {
                    "_id": "59b3d655bb644f0c119e5f50",
                    "name": "Bivouac Break",
                    "value": 11
                },
                {
                    "_id": "59b3d655bb644f0c119e5f49",
                    "name": "M777 Howitzer",
                    "value": 13
                },
                {
                    "_id": "59b3d655bb644f0c119e5f38",
                    "name": "Snake Eye's Uzi",
                    "value": 6
                },
                {
                    "_id": "59b3d655bb644f0c119e5f4e",
                    "name": "PRC-117 Radios HQ",
                    "value": 1
                },
                {
                    "_id": "59b3d655bb644f0c119e5f4f",
                    "name": "MK-54 Torpedo",
                    "value": 10
                },
                {
                    "_id": "59b3d655bb644f0c119e5f51",
                    "name": "AGM-114 Hellfire Missile",
                    "value": 10
                },
                {
                    "_id": "59b3d655bb644f0c119e5f46",
                    "name": "FGM-148 Javelin",
                    "value": 1
                },
                {
                    "_id": "59b3d655bb644f0c119e5f40",
                    "name": "Dig a Trench",
                    "value": 14
                }
            ]
        },
        {
            "_id": "59be7d0b2f7a32313c80d72c",
            "user": {
                "_id": "59be7d0b2f7a32313c80d72b",
                "name": "Beachhead (All Tie)",
                "results": {
                    "draws": 0,
                    "losses": 72,
                    "wins": 5
                },
                "achievements": []
            },
            "__v": 0,
            "createDate": "2017-10-06T15:50:31.561Z",
            "actions": [
                {
                    "_id": "59b3d655bb644f0c119e5f5f",
                    "name": "What Could Go Wrong? Hire Zartan",
                    "value": 3
                },
                {
                    "_id": "59b3d655bb644f0c119e5f48",
                    "name": "S.H.A.R.C. Attack!",
                    "value": 11
                },
                {
                    "_id": "59b3d655bb644f0c119e5f50",
                    "name": "Bivouac Break",
                    "value": 11
                },
                {
                    "_id": "59b3d655bb644f0c119e5f49",
                    "name": "M777 Howitzer",
                    "value": 13
                },
                {
                    "_id": "59b3d655bb644f0c119e5f38",
                    "name": "Snake Eye's Uzi",
                    "value": 6
                },
                {
                    "_id": "59b3d655bb644f0c119e5f4e",
                    "name": "PRC-117 Radios HQ",
                    "value": 1
                },
                {
                    "_id": "59b3d655bb644f0c119e5f4f",
                    "name": "MK-54 Torpedo",
                    "value": 10
                },
                {
                    "_id": "59b3d655bb644f0c119e5f51",
                    "name": "AGM-114 Hellfire Missile",
                    "value": 10
                },
                {
                    "_id": "59b3d655bb644f0c119e5f46",
                    "name": "FGM-148 Javelin",
                    "value": 1
                },
                {
                    "_id": "59b3d655bb644f0c119e5f40",
                    "name": "Dig a Trench",
                    "value": 14
                }
                ]
              }
          ];

        var deferred = $q.defer();
        deferred.resolve(response);
        return deferred.promise;
      },
      getCurrentUserMatches: function(callback) {
        var response = [
            {
                "_id": "59d7a68eaa12411ce8ffb570",
                "deck_one": {
                    "_id": "59bd0502d9aad92ad30220ff",
                    "user": {
                        "_id": "59bd0502d9aad92ad30220fc",
                        "name": "Recondo",
                        "results": {
                            "draws": 0,
                            "losses": 1,
                            "wins": 75
                        }
                    },
                    "__v": 0,
                    "createDate": "2017-10-06T15:50:31.571Z",
                    "actions": [
                        {
                            "_id": "59b3d655bb644f0c119e5f38",
                            "name": "Snake Eye's Uzi",
                            "value": 6
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f4d",
                            "name": "Time for the Night Vision Goggles",
                            "value": 20
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f4a",
                            "name": "Weather Dominator Strike!",
                            "value": 18
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f5f",
                            "name": "What Could Go Wrong? Hire Zartan",
                            "value": 3
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f5b",
                            "name": "Vance Wingfield Plots Overthrow",
                            "value": 16
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f53",
                            "name": "T-11 Parachute",
                            "value": 17
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f60",
                            "name": "Safety of the Pit",
                            "value": 19
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f3b",
                            "name": "Punch",
                            "value": 15
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f47",
                            "name": "MK19 Grenade Machine Gun",
                            "value": 12
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f5a",
                            "name": "Oktober Guard Intervenes",
                            "value": 17
                        }
                    ]
                },
                "deck_two": {
                    "_id": "59bd040511a3892ac5ba27bb",
                    "user": {
                        "_id": "59bd040511a3892ac5ba27b8",
                        "name": "Destro (W4-0)"
                    },
                    "__v": 0,
                    "createDate": "2017-10-06T15:50:31.573Z",
                    "actions": [
                        {
                            "_id": "59b3d655bb644f0c119e5f3e",
                            "name": "LAV-25 Light Armored Vehicle",
                            "value": 21
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f41",
                            "name": "Airstrike!",
                            "value": 20
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f4d",
                            "name": "Time for the Night Vision Goggles",
                            "value": 20
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f5e",
                            "name": "Alternate Reality: World Without End",
                            "value": 19
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f60",
                            "name": "Safety of the Pit",
                            "value": 19
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f4a",
                            "name": "Weather Dominator Strike!",
                            "value": 18
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f43",
                            "name": "M1911 Locked & Loaded",
                            "value": 18
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f5a",
                            "name": "Oktober Guard Intervenes",
                            "value": 17
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f53",
                            "name": "T-11 Parachute",
                            "value": 17
                        },
                        {
                            "_id": "59b3d655bb644f0c119e5f5b",
                            "name": "Vance Wingfield Plots Overthrow",
                            "value": 16
                        }
                    ]
                },
                "story": "One day, in the not so distant future, Recondo will look back upon this day and consider his or her battle as a learning experience. 'The loss does not matter,' Recondo, thinks. Of course, he or she is an idiot and of course the loss matters. Moral victories are great for the movies, but in real life, Destro (W4-0) understands that the sweet taste of victory is more important than slow motion celebrations in the runner's up tent. Congratulations Destro (W4-0). The day is yours. Hold your head high as you march through the streets, waving your victory banner. Does a beverage taste better after a win. Yes. Yes it does. Enjoy a beverage of choice!",
                "reason": "moves",
                "winner": {
                    "_id": "59bd040511a3892ac5ba27b8",
                    "email": "destrosdepot@destro.com",
                    "password": "$2a$10$auEaWuXY2Sp4bqobrO2vO.iivUx5tobyyFG7ZtQ08xqDvsCp4rngO",
                    "name": "Destro (W4-0)",
                    "__v": 0,
                    "results": {
                        "draws": 0,
                        "losses": 0,
                        "wins": 1
                    },
                    "achievements": [],
                    "roles": [
                        "user"
                    ]
                },
                "player_one": "59bd0502d9aad92ad30220fc",
                "player_two": "59bd040511a3892ac5ba27b8",
                "__v": 0,
                "gameDate": "2017-10-06T15:51:42.589Z",
                "type": "vs"
            }
        ];

        var deferred = $q.defer();
        deferred.resolve(response);
        return deferred.promise;
      },
      createMatch: function(match) {
        var response = {};
        var deferred = $q.defer();
        deferred.resolve(response);
        return deferred.promise;
      },
      deleteDeck: function(deck) {
        var result = {
          status: 200
        };
        var deferred = $q.defer();
        deferred.resolve(result);
        return deferred.promise;
      },
      go: function() {
        $httpBackend.when('GET', '/login').respond(200, { location: '/login'} );
        $httpBackend.flush();
      }
    }

    next.access = { restricted: false };

    ctrl = $controller('matchCtrl', { $scope: $scope, $log: $log, $q: $q, $interval: $interval, dataService: dataServiceMock, gameService: gameServiceMock});

  }));

  
  it('should pass a simple test: true = true', function() {
   expect(true).to.equal(true);
   });

  it('should have a matchCtrl', function() {
    expect(ctrl).to.not.be.undefined;
  });

  it('should verify playGame service function exists', inject(function() {
    $scope.$digest();
    expect(gameServiceMock.playGame({}, {})).to.exist;;
  }));

  it('should verify getUserId service function exists', inject(function() {
    $scope.$digest();
    expect(dataServiceMock.getUserId).to.exist;;
  }));

  it('should verify getCurrentUser service function exists', inject(function() {
    $scope.$digest();
    expect(dataServiceMock.getCurrentUser).to.exist;;
  }));

  it('should verify getAllDecks service function exists', inject(function() {
    $scope.$digest();
    expect(dataServiceMock.getAllDecks).to.exist;;
  }));

  it('should verify getCurrentUserMatches service function exists', inject(function() {
    $scope.$digest();
    expect(dataServiceMock.getCurrentUserMatches).to.exist;;
  }));

  it('should verify createMatch service function exists', inject(function() {
    $scope.$digest();
    expect(dataServiceMock.createMatch({})).to.exist;;
  }));

  it('should verify deleteDeck service function exists', inject(function() {
    $scope.$digest();
    expect(dataServiceMock.deleteDeck).to.exist;;
  }));

  it('should verify go service function exists', inject(function() {
    $scope.$digest();
    expect(dataServiceMock.go).to.exist;;
  }));

  it('should match the _id value of user', inject(function() {
    $scope.$digest();
    expect(ctrl.user._id).to.equal('59b3d92a026d930c39bd9ed8');
  }));

  it('should match the _id value of currentUser', inject(function() {
    $scope.$digest();
    expect(ctrl.currentUser._id).to.equal('59b3d92a026d930c39bd9ed8');
  }));

  it('should verify have multiple decks', inject(function() {
    $scope.$digest();
    expect(ctrl.decks).to.have.lengthOf(2);
  }));

  it('should verify matches length', inject(function() {
    $scope.$digest();
    expect(ctrl.matches).to.have.lengthOf(1);
  }));

  it('should delete a deck', inject(function() {
    $scope.$digest();
    expect(ctrl.decks[0]['_id']).to.equal('59b3deef246d150ce329c5ed');
    ctrl.deleteDeck('59b3deef246d150ce329c5ed', 1);
    expect(ctrl.decks).to.have.lengthOf(1);
    //expect(ctrl.decks[0]['_id']).to.equal('59be7d0b2f7a32313c80d72c')
  }));

});